export interface CandidateContactInfo {
  email: string | null
  phone: string | null
}

export function extractContactInfo(text: string): CandidateContactInfo {
  if (!text || typeof text !== 'string') {
    return { email: null, phone: null }
  }

  // 1. Extracción de correo electrónico
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  const email = emailMatch ? emailMatch[0].trim().toLowerCase() : null

  // 2. Extracción de teléfono
  let phone: string | null = null

  // Búsqueda con etiqueta (Teléfono, Celular, Móvil, Phone, WhatsApp, etc.)
  const labeledMatch = text.match(
    /(?:tel[eé]fono|celular|m[oó]vil|whatsapp|phone|cel|tel)[:\s]+([+\d\s().-]{7,25}\d)/i,
  )
  if (labeledMatch) {
    const candidate = labeledMatch[1].trim()
    const digits = candidate.replace(/\D/g, '')
    if (digits.length >= 7 && digits.length <= 15) {
      phone = candidate
    }
  }

  // Si no se encontró con etiqueta, buscar patrón telefónico general
  if (!phone) {
    const generalMatch = text.match(
      /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/,
    )
    if (generalMatch) {
      const candidate = generalMatch[0].trim()
      const digits = candidate.replace(/\D/g, '')
      if (digits.length >= 7 && digits.length <= 15) {
        phone = candidate
      }
    }
  }

  return { email, phone }
}
