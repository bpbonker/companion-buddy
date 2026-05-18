import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMemo } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { VariablesProvider } from './editor/VariablesContext'
import { EditorRoute } from './routes/EditorRoute'
import { KioskRoute } from './routes/KioskRoute'
import { PanelListRoute } from './routes/PanelListRoute'
import { TrpcProvider } from './trpc'

export function App() {
	const queryClient = useMemo(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 5_000,
						refetchOnWindowFocus: false,
					},
				},
			}),
		[]
	)

	// In dev BASE_URL is "/"; in the production build (vite build --base=/panels-ui/)
	// it becomes "/panels-ui/". Strip the trailing slash for React Router's basename.
	const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

	return (
		<QueryClientProvider client={queryClient}>
			<TrpcProvider queryClient={queryClient}>
				<BrowserRouter basename={basename}>
					<Routes>
						<Route path="/" element={<Navigate to="/editor" replace />} />
						<Route
							path="/editor"
							element={
								<VariablesProvider>
									<PanelListRoute />
								</VariablesProvider>
							}
						/>
						<Route
							path="/editor/:panelId"
							element={
								<VariablesProvider>
									<EditorRoute />
								</VariablesProvider>
							}
						/>
						<Route path="/panel/:slug" element={<KioskRoute />} />
					</Routes>
				</BrowserRouter>
			</TrpcProvider>
		</QueryClientProvider>
	)
}
