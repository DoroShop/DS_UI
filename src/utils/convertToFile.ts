export function dataUrlToFile(dataUrl: string, index) {
  const [header, base64] = dataUrl.split(',')
  const mimeMatch = header.match(/data:(.*?);base64/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  const ext = mime.split('/')[1] || 'jpg'
  return new File([bytes], `upload-${Date.now()}-${index}.${ext}`, { type: mime })
}