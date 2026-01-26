export interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

export interface UploadResponse {
  images?: Array<{ url: string }>
  url?: string
  error?: string
}
