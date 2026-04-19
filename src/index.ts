import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'

type Bindings = { hono_prisma_db: D1Database }

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', logger())
app.use('*', prettyJSON())

const todoSchema = z.object({
  title:     z.string().min(1),
  completed: z.boolean().optional(),
})

function getDB(d1: D1Database) {
  const adapter = new PrismaD1(d1)
  return new PrismaClient({ adapter })
}

app.get('/api/todos', async (c) => {
  const prisma = getDB(c.env.hono_prisma_db)
  const todos = await prisma.todo.findMany({ orderBy: { id: 'asc' } })
  return c.json(todos)
})

app.get('/api/todos/:id', async (c) => {
  const prisma = getDB(c.env.hono_prisma_db)
  const id = Number(c.req.param('id'))
  const todo = await prisma.todo.findUnique({ where: { id } })
  if (!todo) return c.json({ error: 'Not found' }, 404)
  return c.json(todo)
})

app.post('/api/todos', zValidator('json', todoSchema), async (c) => {
  const prisma = getDB(c.env.hono_prisma_db)
  const todo = await prisma.todo.create({ data: c.req.valid('json') })
  return c.json(todo, 201)
})

app.put('/api/todos/:id', zValidator('json', todoSchema.partial()), async (c) => {
  const prisma = getDB(c.env.hono_prisma_db)
  const id = Number(c.req.param('id'))
  const todo = await prisma.todo.update({
    where: { id },
    data: c.req.valid('json'),
  })
  return c.json(todo)
})

app.delete('/api/todos/:id', async (c) => {
  const prisma = getDB(c.env.hono_prisma_db)
  const id = Number(c.req.param('id'))
  await prisma.todo.delete({ where: { id } })
  return c.body(null, 204)
})

app.onError((err, c) =>
  c.json({ error: 'Internal Server Error', message: err.message }, 500))
app.notFound((c) =>
  c.json({ error: `Route ${c.req.path} not found` }, 404))

export default app
