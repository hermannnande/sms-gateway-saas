import PairClient from './pair-client'

export const dynamic = 'force-dynamic'

export default function PairAppPage({
  searchParams,
}: {
  searchParams: { device_token?: string; device_name?: string }
}) {
  return (
    <PairClient
      deviceToken={(searchParams.device_token ?? '').toString()}
      deviceName={(searchParams.device_name ?? '').toString()}
    />
  )
}


