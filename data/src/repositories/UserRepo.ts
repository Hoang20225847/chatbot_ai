import { User, IUser } from "../models/User";

export interface IUserRepo {
  create: (data: IUser) => Promise<IUser>;
  findByEmail: (email: string) => Promise<IUser | null>;
}

export class UserRepo implements IUserRepo {
  async create(data: IUser) {
    return await User.create(data);
  }

  async findByEmail(email: string) {
    return await User.findOne({ email }).exec();
  }
}
