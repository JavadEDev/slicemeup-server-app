import 'dotenv/config';
import fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import fastifyCors from '@fastify/cors';
import 'pino-pretty';
import fs from 'fs';

const app = fastify({
  logger: {
    transport: { target: 'pino-pretty' }
  }
});

app.register(fastifyCors, {
  origin: [
    'https://pizza-front-sooty.vercel.app', // Your frontend Vercel URL
    'https://pizza-server-iota.vercel.app/',
    'http://localhost:5173', // Your local development URL
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 
});

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

try {
  const publicPath = path.join(__dirname, 'public');
  if (fs.existsSync(publicPath)) {
    app.register(fastifyStatic, {
      root: publicPath,
      prefix: '/public/',
      decorateReply: false,
    });
  } else {
    app.log.warn('Public directory not found, static file serving disabled');
  }
} catch (error) {
  app.log.error('Error setting up static file serving:', error);
}

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
  return res.status(200).send({
    status: 'SliceMeUp API is live',
    version: '1.0.0',
    endpoints: {
      pizzas: '/api/pizzas',
      order: '/api/order',
      pastOrders: '/api/past-orders'
    }
  });
})
app.get('/api', () => ({ status: 'SliceMeUp API is live' }));


app.get("/api/pizzas", async function getPizzas(req, res) {
  const pizzasPromise = db.all(
    "SELECT pizza_type_id, name, category, ingredients as description FROM pizza_types"
  );
  const pizzaSizesPromise = db.all(
    `SELECT 
      pizza_type_id as id, size, price
    FROM 
      pizzas
  `
  );

  const [pizzas, pizzaSizes] = await Promise.all([
    pizzasPromise,
    pizzaSizesPromise,
  ]);

  const responsePizzas = pizzas.map((pizza) => {
    const sizes = pizzaSizes.reduce((acc, current) => {
      if (current.id === pizza.pizza_type_id) {
        acc[current.size] = +current.price;
      }
      return acc;
    }, {});
    return {
      id: pizza.pizza_type_id,
      name: pizza.name,
      category: pizza.category,
      description: pizza.description,
      image: `/pizzas/${pizza.pizza_type_id}.webp`,
      sizes,
    };
  });

  res.send(responsePizzas);
});

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
  
//   app.post("/api/order", async function createOrder(req, res) {
//     const { cart } = req.body;
  
//     const now = new Date();
//     const time = now.toLocaleTimeString("en-US", { hour12: false });
//     const date = now.toISOString().split("T")[0];
  
//     if (!cart || !Array.isArray(cart) || cart.length === 0) {
//       res.status(400).send({ error: "Invalid order data" });
//       return;
//     }

//     let transactionStarted = false;
//     try {
//       // Start transaction
//       await db.run("BEGIN TRANSACTION");
//       transactionStarted = true;
//       req.log.info("Transaction started successfully");
  
//       const result = await db.run(
//         "INSERT INTO orders (date, time) VALUES (?, ?)",
//         [date, time]
//       );
//       const orderId = result.lastInsertRowid;
//       req.log.info(`Order created with ID: ${orderId}`);
  
//       // Log the cart before processing
//       req.log.info(`Processing cart: ${JSON.stringify(cart, null, 2)}`);
  
//       const mergedCart = cart.reduce((acc, item) => {
//         const id = item.pizza.id;
//         const size = item.size.toLowerCase();
//         if (!id || !size) {
//           throw new Error("Invalid item data");
//         }
//         const pizzaId = `${id}_${size}`;

//         req.log.info(`Processing item - pizzaId: ${pizzaId}, id: ${id}, size: ${size}`);
  
//         if (!acc[pizzaId]) {
//           acc[pizzaId] = { pizzaId, quantity: 1 };
//           req.log.info(`New item added to accumulator: ${pizzaId}`);
//         } else {
//           acc[pizzaId].quantity += 1;
//           req.log.info(`Updated quantity for ${pizzaId}: ${acc[pizzaId].quantity}`);
//         }
        
//         // Log the current state of the accumulator
//         req.log.info(`Current accumulator state: ${JSON.stringify(acc, null, 2)}`);
//         return acc;
//       }, {});
  
//       // Log the final merged cart
//       req.log.info(`Final merged cart: ${JSON.stringify(mergedCart, null, 2)}`);
  
//       // Process each item in the merged cart
//       for (const item of Object.values(mergedCart)) {
//         const { pizzaId, quantity } = item;
//         req.log.info(`Inserting order detail - orderId: ${orderId}, pizzaId: ${pizzaId}, quantity: ${quantity}`);
//         await db.run(
//           "INSERT INTO order_details (order_id, pizza_id, quantity) VALUES (?, ?, ?)",
//           [orderId, pizzaId, quantity]
//         );
//       }
  
//       if (!transactionStarted) {
//         throw new Error("Transaction was not active before commit");
//       }
      
//       await db.run("COMMIT");
//       transactionStarted = false;
//       req.log.info("Transaction committed successfully");
  
//       res.send({ orderId });
//     } catch (error) {
//       req.log.error({
//         error: error.message,
//         stack: error.stack,
//         transactionStarted,
//         cart: JSON.stringify(cart, null, 2),
//         mergedCart: mergedCart ? JSON.stringify(mergedCart, null, 2) : 'not created'
//       });
      
//       if (transactionStarted) {
//         try {
//           req.log.info("Attempting to rollback transaction...");
//           await db.run("ROLLBACK");
//           req.log.info("Transaction rolled back successfully");
//         } catch (rollbackError) {
//           req.log.error("Failed to rollback transaction:", rollbackError);
//         }
//       } else {
//         req.log.error("No transaction was active, skipping rollback");
//       }
      
//       res.status(500).send({ 
//         error: "Failed to create order",
//         details: error.message 
//       });
//     }
// });

app.post("/api/order", async function createOrder(req, res) {
  const { cart } = req.body;
  let transactionStarted = false;
  let mergedCart = null;
  let orderId = null;

  const now = new Date();
  const time = now.toLocaleTimeString("en-US", { hour12: false });
  const date = now.toISOString().split("T")[0];

  if (!cart || !Array.isArray(cart) || cart.length === 0) {
    res.status(400).send({ error: "Invalid order data" });
    return;
  }

  try {
    // Start transaction using Turso's transaction API
    req.log.info("Starting transaction...");
    const transaction = await turso.transaction();
    transactionStarted = true;
    req.log.info("Transaction started successfully");

    // Use transaction.execute instead of db.run
    const result = await transaction.execute({
      sql: "INSERT INTO orders (date, time) VALUES (?, ?)",
      args: [date, time]
    });
    orderId = Number(result.lastInsertRowid);
    req.log.info(`Order created with ID: ${orderId}`);

    mergedCart = cart.reduce((acc, item) => {
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

    // Process each item in the merged cart using transaction
    for (const item of Object.values(mergedCart)) {
      const { pizzaId, quantity } = item;
      req.log.info(`Inserting order detail for order ${orderId}: ${ pizzaId, quantity }`);
      await transaction.execute({
        sql: "INSERT INTO order_details (order_id, pizza_id, quantity) VALUES (?, ?, ?)",
        args: [orderId, pizzaId, quantity]
      });
    }

    req.log.info("All order details inserted, committing transaction...");
    await transaction.commit();
    transactionStarted = false;
    req.log.info("Transaction committed successfully");

    res.send({ orderId });
  } catch (error) {
    req.log.error({
      error: error.message,
      stack: error.stack,
      transactionStarted,
      orderId,
      cart: JSON.stringify(cart, null, 2),
      mergedCart: mergedCart ? JSON.stringify(mergedCart, null, 2) : 'not created'
    });
    
    if (transactionStarted) {
      try {
        req.log.info(`Rolling back transaction for order ${orderId}...`);
        await transaction.rollback();
        req.log.info("Transaction rolled back successfully");
      } catch (rollbackError) {
        req.log.error("Failed to rollback transaction:", rollbackError);
      }
    } else {
      req.log.error("No transaction was active, skipping rollback");
    }
    
    res.status(500).send({ 
      error: "Failed to create order",
      details: error.message 
    });
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

