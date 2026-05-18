import type { QueryClient } from '@tanstack/react-query'
import { createTRPCClient, createWSClient, wsLink } from '@trpc/client'
import { createTRPCContext } from '@trpc/tanstack-react-query'
import { useMemo, type PropsWithChildren } from 'react'

// Loose typing on purpose — webui-panels does not need to compile-time-link to the
// companion backend's AppRouter type. Procedure paths are referenced as strings at the
// edges (panels.list, panels.get, panels.save, panels.tokens.list, panels.tokens.mint, panels.tokens.revoke,
// variables.connection, instances.list). At runtime everything is validated by zod on the server.
type AnyAppRouter = any

const { TRPCProvider, useTRPC } = createTRPCContext<AnyAppRouter>()

export { useTRPC }

function buildTrpcWsUrl(): string {
	const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
	return `${proto}//${window.location.host}/trpc`
}

export function TrpcProvider({ children, queryClient }: PropsWithChildren<{ queryClient: QueryClient }>) {
	const trpcClient = useMemo(() => {
		const wsClient = createWSClient({ url: buildTrpcWsUrl() })
		return createTRPCClient<AnyAppRouter>({
			links: [wsLink({ client: wsClient })],
		})
	}, [])

	return (
		<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
			{children}
		</TRPCProvider>
	)
}
