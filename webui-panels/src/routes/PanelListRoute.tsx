import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { PanelSummary } from '@companion-app/shared/Model/PanelModel.js'
import { useTRPC } from '../trpc'

export function PanelListRoute() {
	const trpc = useTRPC()
	const queryClient = useQueryClient()
	const navigate = useNavigate()
	const [showNew, setShowNew] = useState(false)

	const listQuery = useQuery(trpc.panels.list.queryOptions())
	const panels: PanelSummary[] = listQuery.data ?? []

	const deleteMutation = useMutation(
		trpc.panels.delete.mutationOptions({
			onSuccess: async () => queryClient.invalidateQueries({ queryKey: trpc.panels.list.queryKey() }),
		})
	)

	const createMutation = useMutation(
		trpc.panels.create.mutationOptions({
			onSuccess: (created: any) => {
				queryClient.invalidateQueries({ queryKey: trpc.panels.list.queryKey() })
				setShowNew(false)
				if (created?.id) navigate(`/editor/${created.id}`)
			},
		})
	)

	return (
		<div className="app-shell">
			<div className="toolbar">
				<div className="brand">
					Companion<span className="accent">/</span>Panels
				</div>
				<div className="title">All panels</div>
				<button className="primary" onClick={() => setShowNew(true)}>
					+ New panel
				</button>
			</div>

			<div className="panel-list">
				<h2 style={{ marginTop: 0 }}>Panels</h2>
				{listQuery.isLoading && <p>Loading…</p>}
				{listQuery.error && <p style={{ color: '#fca5a5' }}>Failed to load: {String(listQuery.error)}</p>}
				{!listQuery.isLoading && panels.length === 0 && (
					<p style={{ color: '#64748b' }}>No panels yet. Click "+ New panel" to create one.</p>
				)}
				<ul>
					{panels.map((p) => (
						<li key={p.id}>
							<div style={{ flex: 1 }}>
								<div className="name">{p.name}</div>
								<div className="slug">
									/panel/{p.slug} — {p.itemCount} items, {p.tokenCount} devices
								</div>
							</div>
							<Link to={`/editor/${p.id}`}>
								<button>Edit</button>
							</Link>
							<button
								className="danger"
								onClick={() => {
									if (confirm(`Delete panel "${p.name}"?`)) {
										deleteMutation.mutate({ id: p.id })
									}
								}}
							>
								Delete
							</button>
						</li>
					))}
				</ul>
			</div>

			{showNew && (
				<NewPanelDialog
					onCancel={() => setShowNew(false)}
					onCreate={(input) => createMutation.mutate(input)}
					pending={createMutation.isPending}
					error={createMutation.error ? String(createMutation.error) : null}
				/>
			)}
		</div>
	)
}

function NewPanelDialog(props: {
	onCancel: () => void
	onCreate: (input: { slug: string; name: string }) => void
	pending: boolean
	error: string | null
}) {
	const [name, setName] = useState('')
	const [slug, setSlug] = useState('')

	function submit() {
		const finalSlug = slug.trim() || slugify(name)
		if (!name.trim() || !finalSlug) return
		props.onCreate({ name: name.trim(), slug: finalSlug })
	}

	return (
		<div className="modal-backdrop" onClick={props.onCancel}>
			<div className="modal" onClick={(e) => e.stopPropagation()}>
				<h2>New panel</h2>
				<div className="field">
					<label>Name</label>
					<input
						value={name}
						onChange={(e) => setName(e.target.value)}
						onBlur={() => setSlug((s) => (s ? s : slugify(name)))}
						autoFocus
					/>
				</div>
				<div className="field">
					<label>URL slug</label>
					<input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={slugify(name) || 'my-panel'} />
					<div style={{ fontSize: 11, color: '#64748b' }}>/panel/{slug || slugify(name) || '…'}</div>
				</div>
				{props.error && <div style={{ color: '#fca5a5', fontSize: 12 }}>{props.error}</div>}
				<div className="actions">
					<button onClick={props.onCancel}>Cancel</button>
					<button className="primary" onClick={submit} disabled={props.pending || !name.trim()}>
						{props.pending ? 'Creating…' : 'Create'}
					</button>
				</div>
			</div>
		</div>
	)
}

function slugify(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}
