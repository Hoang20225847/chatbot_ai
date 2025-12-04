import { createClient } from "redis";

export const redisClient = createClient({
  url: process.env.REDIS_URI,
});

redisClient
  .connect()
  .then(() =>
    console.log(`Connected to Redis at ${sanitizeURI(process.env.REDIS_URI!)}`)
  )
  .catch((err) => console.log("Redis connection error: ", err));

redisClient.on("error", (err) => {
  console.error("Redis runtime error:", err);
});

function sanitizeURI(uri: string): string {
  try {
    // Match any protocol://username:password@
    const regex = /^([a-zA-Z+\-\.]+:\/\/)([^:]+):([^@]+)@/;
    return uri.replace(regex, "$1****:****@");
  } catch (error) {
    return "[invalid-uri]";
  }
}
