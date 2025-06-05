import 'dotenv/config';
import fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import 'pino-pretty';            

const app = fastify({
  logger: {
    transport: { target: 'pino-pretty' }
  }
});


const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

app.register(fastifyStatic, {
  root:   path.join(__dirname, 'public'),
  prefix: '/public/',
});

const turso = createClient({
  url:       process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = {
  all: async (sql, args = []) =>  (await turso.execute({ sql, args })).rows,
  get: async (sql, args = []) =>  (await turso.execute({ sql, args })).rows[0],
  run: async (sql, args = []) =>  turso.execute({ sql, args }),
};


app.get('/', async (req, res) => {
  return res.status(200).type('text/html').send(html)
})
app.get('/api', () => ({ status: 'SliceMeUp API is live' }));

app.get('/pizzas', async () => {
  const pizzas        = await db.all(
    'SELECT pizza_type_id, name, category, ingredients AS description FROM pizza_types'
  );
  const pizzaSizes    = await db.all(
    `SELECT pizza_type_id AS id, size, price FROM pizzas`
  );

  return pizzas.map(p => {
    const sizes = pizzaSizes.reduce((acc, cur) => {
      if (cur.id === p.pizza_type_id) acc[cur.size] = +cur.price;
      return acc;
    }, {});
    return {
      id:          p.pizza_type_id,
      name:        p.name,
      category:    p.category,
      description: p.description,
      image:       `/public/pizzas/${p.pizza_type_id}.webp`,
      sizes,
    };
  });
});
// app.get("/api/pizzas", async function getPizzas(req, res) {
//   const pizzasPromise = db.all(
//     "SELECT pizza_type_id, name, category, ingredients as description FROM pizza_types"
//   );
//   const pizzaSizesPromise = db.all(
//     `SELECT 
//       pizza_type_id as id, size, price
//     FROM 
//       pizzas
//   `
//   );

//   const [pizzas, pizzaSizes] = await Promise.all([
//     pizzasPromise,
//     pizzaSizesPromise,
//   ]);

//   const responsePizzas = pizzas.map((pizza) => {
//     const sizes = pizzaSizes.reduce((acc, current) => {
//       if (current.id === pizza.pizza_type_id) {
//         acc[current.size] = +current.price;
//       }
//       return acc;
//     }, {});
//     return {
//       id: pizza.pizza_type_id,
//       name: pizza.name,
//       category: pizza.category,
//       description: pizza.description,
//       image: `/pizzas/${pizza.pizza_type_id}.webp`,
//       sizes,
//     };
//   });

//   res.send(responsePizzas);
// });

app.get('/api/pizza-of-the-day', async () => {
  const pizzas = await db.all(`
    SELECT pizza_type_id AS id, name, category, ingredients AS description
    FROM   pizza_types`);
  const index  = Math.floor(Date.now() / 86_400_000) % pizzas.length;
  const pizza  = pizzas[index];

  const sizes  = await db.all(
    'SELECT size, price FROM pizzas WHERE pizza_type_id = ?', [pizza.id]);
  const sizeObj = sizes.reduce((a, c) => ({ ...a, [c.size]: +c.price }), {});

  return {
    ...pizza,
    image: `/public/pizzas/${pizza.id}.webp`,
    sizes : sizeObj,
  };
});
app.get("/api/orders", async function getOrders(req, res) {
    const id = req.query.id;
    const orders = await db.all("SELECT order_id, date, time FROM orders");
  
    res.send(orders);
  });
  
  app.get("/api/order", async function getOrders(req, res) {
    const id = req.query.id;
    const orderPromise = db.get(
      "SELECT order_id, date, time FROM orders WHERE order_id = ?",
      [id]
    );
    const orderItemsPromise = db.all(
      `SELECT 
        t.pizza_type_id as pizzaTypeId, t.name, t.category, t.ingredients as description, o.quantity, p.price, o.quantity * p.price as total, p.size
      FROM 
        order_details o
      JOIN
        pizzas p
      ON
        o.pizza_id = p.pizza_id
      JOIN
        pizza_types t
      ON
        p.pizza_type_id = t.pizza_type_id
      WHERE 
        order_id = ?`,
      [id]
    );
  
    const [order, orderItemsRes] = await Promise.all([
      orderPromise,
      orderItemsPromise,
    ]);
  
    const orderItems = orderItemsRes.map((item) =>
      Object.assign({}, item, {
        image: `/public/pizzas/${item.pizzaTypeId}.webp`,
        quantity: +item.quantity,
        price: +item.price,
      })
    );
  
    const total = orderItems.reduce((acc, item) => acc + item.total, 0);
  
    res.send({
      order: Object.assign({ total }, order),
      orderItems,
    });
  });
  
  app.post("/api/order", async function createOrder(req, res) {
    const { cart } = req.body;
  
    const now = new Date();
    // forgive me Date gods, for I have sinned
    const time = now.toLocaleTimeString("en-US", { hour12: false });
    const date = now.toISOString().split("T")[0];
  
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      res.status(400).send({ error: "Invalid order data" });
      return;
    }
  
    try {
      await db.run("BEGIN TRANSACTION");
  
      const result = await db.run(
        "INSERT INTO orders (date, time) VALUES (?, ?)",
        [date, time]
      );
      const orderId = result.lastID;
  
      const mergedCart = cart.reduce((acc, item) => {
        const id = item.pizza.id;
        const size = item.size.toLowerCase();
        if (!id || !size) {
          throw new Error("Invalid item data");
        }
        const pizzaId = `${id}_${size}`;
  
        if (!acc[pizzaId]) {
          acc[pizzaId] = { pizzaId, quantity: 1 };
        } else {
          acc[pizzaId].quantity += 1;
        }
  
        return acc;
      }, {});
  
      for (const item of Object.values(mergedCart)) {
        const { pizzaId, quantity } = item;
        await db.run(
          "INSERT INTO order_details (order_id, pizza_id, quantity) VALUES (?, ?, ?)",
          [orderId, pizzaId, quantity]
        );
      }
  
      await db.run("COMMIT");
  
      res.send({ orderId });
    } catch (error) {
      req.log.error(error);
      await db.run("ROLLBACK");
      res.status(500).send({ error: "Failed to create order" });
    }
  });
  
  app.get("/api/past-orders", async function getPastOrders(req, res) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = 20;
      const offset = (page - 1) * limit;
      const pastOrders = await db.all(
        "SELECT order_id, date, time FROM orders ORDER BY order_id DESC LIMIT 10 OFFSET ?",
        [offset]
      );
      res.send(pastOrders);
    } catch (error) {
      req.log.error(error);
      res.status(500).send({ error: "Failed to fetch past orders" });
    }
  });
  
  app.get("/api/past-order/:order_id", async function getPastOrder(req, res) {
    const orderId = req.params.order_id;
  
    try {
      const order = await db.get(
        "SELECT order_id, date, time FROM orders WHERE order_id = ?",
        [orderId]
      );
  
      if (!order) {
        res.status(404).send({ error: "Order not found" });
        return;
      }
  
      const orderItems = await db.all(
        `SELECT 
          t.pizza_type_id as pizzaTypeId, t.name, t.category, t.ingredients as description, o.quantity, p.price, o.quantity * p.price as total, p.size
        FROM 
          order_details o
        JOIN
          pizzas p
        ON
          o.pizza_id = p.pizza_id
        JOIN
          pizza_types t
        ON
          p.pizza_type_id = t.pizza_type_id
        WHERE 
          order_id = ?`,
        [orderId]
      );
  
      const formattedOrderItems = orderItems.map((item) =>
        Object.assign({}, item, {
          image: `/public/pizzas/${item.pizzaTypeId}.webp`,
          quantity: +item.quantity,
          price: +item.price,
        })
      );
  
      const total = formattedOrderItems.reduce(
        (acc, item) => acc + item.total,
        0
      );
  
      res.send({
        order: Object.assign({ total }, order),
        orderItems: formattedOrderItems,
      });
    } catch (error) {
      req.log.error(error);
      res.status(500).send({ error: "Failed to fetch order" });
    }
  });
  
  app.post("/api/contact", async function contactForm(req, res) {
    const { name, email, message } = req.body;
  
    if (!name || !email || !message) {
      res.status(400).send({ error: "All fields are required" });
      return;
    }
  
    req.log.info(`Contact Form Submission:
      Name: ${name}
      Email: ${email}
      Message: ${message}
    `);
  
    res.send({ success: "Message received" });
  });
  
  export default async function handler(req, res) {
    await app.ready()
    app.server.emit('request', req, res)
  }

