import { handleApiRequest } from '../server/server.mjs'

export const config = {
  maxDuration: 120,
}

export default function handler(request, response) {
  return handleApiRequest(request, response)
}
