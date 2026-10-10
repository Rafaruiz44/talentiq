import { createApiRequestHandler } from '../server/server.mjs'

const handler = createApiRequestHandler()

export default async function candidatesApiHandler(request, response) {
  await handler(request, response)
}
