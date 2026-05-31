import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

const loginForm = document.getElementById('admin-login')
const logoutButton = document.getElementById('admin-logout')
const refreshButton = document.getElementById('admin-refresh')
const statusEl = document.getElementById('admin-status')
const contactContainer = document.getElementById('admin-contact')
const serviceContainer = document.getElementById('admin-service')
const adminData = document.querySelector('.admin-data')

const contactColumns = [
  { label: 'Submitted', key: 'created_at', type: 'date' },
  { label: 'Name', key: 'name' },
  { label: 'Email', key: 'email' },
  { label: 'Message', key: 'message' }
]

const serviceColumns = [
  { label: 'Submitted', key: 'created_at', type: 'date' },
  { label: 'Name', key: 'name' },
  { label: 'Phone', key: 'phone' },
  { label: 'Email', key: 'email' },
  { label: 'Aircon', key: 'aircon_type' },
  { label: 'Issue', key: 'issue' }
]

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return String(value)
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}

const setStatus = (state, message) => {
  if (!statusEl) return
  statusEl.textContent = message
  statusEl.classList.remove('success', 'error')
  if (state) {
    statusEl.classList.add(state)
  }
}

const setTableMessage = (container, message) => {
  if (!container) return
  container.innerHTML = `<p class="admin-empty">${message}</p>`
}

const renderTable = (container, columns, rows) => {
  if (!container) return
  if (!rows || rows.length === 0) {
    setTableMessage(container, 'No submissions yet.')
    return
  }

  const thead = columns.map((col) => `<th>${col.label}</th>`).join('')
  const tbody = rows
    .map((row) => {
      const cells = columns
        .map((col) => {
          const rawValue = row[col.key]
          const value = col.type === 'date' ? formatDate(rawValue) : formatValue(rawValue)
          return `<td>${value}</td>`
        })
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')

  container.innerHTML = `
    <table>
      <thead>
        <tr>${thead}</tr>
      </thead>
      <tbody>
        ${tbody}
      </tbody>
    </table>
  `
}

const loadSubmissions = async () => {
  if (!supabase) return

  setTableMessage(contactContainer, 'Loading contact messages...')
  setTableMessage(serviceContainer, 'Loading service requests...')

  const { data: contactRows, error: contactError } = await supabase
    .from('contact_messages')
    .select('created_at,name,email,message')
    .order('created_at', { ascending: false })
    .limit(100)

  if (contactError) {
    console.error(contactError)
    setTableMessage(contactContainer, 'Unable to load contact messages.')
  } else {
    renderTable(contactContainer, contactColumns, contactRows)
  }

  const { data: serviceRows, error: serviceError } = await supabase
    .from('service_requests')
    .select('created_at,name,phone,email,aircon_type,issue')
    .order('created_at', { ascending: false })
    .limit(100)

  if (serviceError) {
    console.error(serviceError)
    setTableMessage(serviceContainer, 'Unable to load service requests.')
  } else {
    renderTable(serviceContainer, serviceColumns, serviceRows)
  }
}

const updateAuthUI = (session) => {
  const locked = !session
  if (adminData) {
    adminData.classList.toggle('is-locked', locked)
  }
  if (logoutButton) {
    logoutButton.disabled = locked
  }

  if (locked) {
    setTableMessage(contactContainer, 'Sign in to view submissions.')
    setTableMessage(serviceContainer, 'Sign in to view submissions.')
  } else {
    loadSubmissions()
  }
}

const handleLogin = async (event) => {
  event.preventDefault()

  if (!supabase) {
    setStatus('error', 'Supabase is not configured. Check Vercel env vars.')
    return
  }

  const email = document.getElementById('admin-email')?.value?.trim()
  const password = document.getElementById('admin-password')?.value

  if (!email || !password) {
    setStatus('error', 'Enter your email and password.')
    return
  }

  setStatus(null, '')
  const submitButton = loginForm?.querySelector('button[type="submit"]')
  if (submitButton) submitButton.disabled = true

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.error(error)
    setStatus('error', error.message)
  } else {
    setStatus('success', 'Signed in successfully.')
    if (loginForm) loginForm.reset()
  }

  if (submitButton) submitButton.disabled = false
}

const handleLogout = async () => {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error(error)
    setStatus('error', error.message)
  } else {
    setStatus(null, 'Signed out.')
  }
}

const init = async () => {
  if (!supabase) {
    setStatus('error', 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.')
    setTableMessage(contactContainer, 'Supabase is not configured.')
    setTableMessage(serviceContainer, 'Supabase is not configured.')
    return
  }

  const { data } = await supabase.auth.getSession()
  updateAuthUI(data.session)

  supabase.auth.onAuthStateChange((_event, session) => {
    updateAuthUI(session)
  })
}

if (loginForm) {
  loginForm.addEventListener('submit', handleLogin)
}

if (logoutButton) {
  logoutButton.addEventListener('click', handleLogout)
}

if (refreshButton) {
  refreshButton.addEventListener('click', () => {
    if (!adminData?.classList.contains('is-locked')) {
      loadSubmissions()
    }
  })
}

init()
