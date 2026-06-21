'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Generate a 60-second signed URL for a lease PDF.
 * RLS (leases_select_tenant) ensures only the lease's own tenant can fetch
 * the document_path. Returns null if the lease is not found or has no document.
 */
export async function generateLeaseDownloadUrl(leaseId: string): Promise<string | null> {
  const supabase = await createClient()

  // Fetch the lease — RLS ensures only the caller's own lease is returned
  const { data: lease } = await supabase
    .from('leases')
    .select('document_path')
    .eq('id', leaseId)
    .maybeSingle()

  if (!lease?.document_path) return null

  const { data: signedData, error } = await supabase.storage
    .from('org-assets')
    .createSignedUrl(lease.document_path, 60)

  if (error || !signedData?.signedUrl) return null

  return signedData.signedUrl
}
