import { createApiRequestHandler } from '../server/server.mjs'

const handler = createApiRequestHandler()

export default async function vercelApiHandler(request, response) {
  await handler(request, response)
}
