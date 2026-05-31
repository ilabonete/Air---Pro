import './style.css'
import Alpine from 'alpinejs'
import { createClient } from '@supabase/supabase-js'

window.Alpine = Alpine

Alpine.start()

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
	console.warn('Missing Supabase env vars: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
}

const supabase = supabaseUrl && supabaseAnonKey
	? createClient(supabaseUrl, supabaseAnonKey)
	: null

const formConfigs = {
	contact: {
		table: 'contact_messages',
		fields: ['name', 'email', 'message'],
		successMessage: 'Thanks! Your message is in. We will reply soon.'
	},
	service: {
		table: 'service_requests',
		fields: ['name', 'phone', 'email', 'address', 'aircon_type', 'issue', 'preferred_date', 'preferred_time'],
		successMessage: 'Thanks! Your service request is received. We will reach out to confirm.'
	}
}

const normalizeValue = (value) => (value === '' ? null : value)

const setStatus = (form, state, message) => {
	const status = form.querySelector('.form-status')
	if (!status) return
	status.textContent = message
	status.classList.remove('success', 'error')
	if (state) {
		status.classList.add(state)
	}
}

const setLoading = (form, isLoading) => {
	const button = form.querySelector('button[type="submit"]')
	if (button) {
		button.disabled = isLoading
	}
	form.classList.toggle('is-loading', isLoading)
	form.setAttribute('aria-busy', isLoading ? 'true' : 'false')
}

const handleSubmit = async (event) => {
	event.preventDefault()
	const form = event.currentTarget
	const type = form.dataset.form
	const config = formConfigs[type]

	if (!config || !supabase) {
		setStatus(form, 'error', 'Form is not configured yet. Please try again later.')
		return
	}

	const formData = new FormData(form)
	const payload = config.fields.reduce((acc, field) => {
		acc[field] = normalizeValue(formData.get(field)?.toString().trim() || '')
		return acc
	}, {})

	setStatus(form, null, '')
	setLoading(form, true)

	try {
		const { data, error } = await supabase
			.from(config.table)
			.insert(payload)
			.select('id')
			.single()

		if (error) {
			throw error
		}

		form.reset()
		setStatus(form, 'success', config.successMessage)

		try {
			await supabase.functions.invoke('notify-submission', {
				body: {
					type,
					id: data?.id
				}
			})
		} catch (notifyError) {
			console.warn('Notify function failed', notifyError)
		}
	} catch (submitError) {
		console.error(submitError)
		setStatus(form, 'error', 'Something went wrong. Please try again.')
	} finally {
		setLoading(form, false)
	}
}

document.addEventListener('DOMContentLoaded', () => {
	const forms = document.querySelectorAll('form[data-form]')
	forms.forEach((form) => {
		form.addEventListener('submit', handleSubmit)
	})
})

