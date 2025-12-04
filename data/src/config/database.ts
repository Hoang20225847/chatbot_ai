import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

export const connectDB = function () {
  return mongoose
    .connect(MONGODB_URI!)
    .then(() =>
      console.log(`Connected to MongoDB at ${sanitizeURI(MONGODB_URI!)}`)
    )
    .catch((err) => console.log(err));
};

function sanitizeURI(uri: string): string {
  try {
    // Match any protocol://username:password@
    const regex = /^([a-zA-Z+\-\.]+:\/\/)([^:]+):([^@]+)@/;
    return uri.replace(regex, "$1****:****@");
  } catch (error) {
    return "[invalid-uri]";
  }
}
