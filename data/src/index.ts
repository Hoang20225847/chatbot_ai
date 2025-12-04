// data/src/index.ts
// Export database connection
export * from "./config/database";

// Export User related
export * from "./repositories/UserRepo";
export { User, type IUser } from "./models/User";

// Export Conversation related
export * from "./repositories/ConversationRepo";
export { Conversation, type IConversation, type IMessage } from "./models/Conversation";

// Export AuditFinding related
export * from "./repositories/AuditFindingRepo";
export { AuditFinding, type IAuditFinding } from "./models/audit-finding.model";

// Export default repo instances
import { UserRepo } from "./repositories/UserRepo";
import { ConversationRepo } from "./repositories/ConversationRepo";
import { AuditFindingRepo } from "./repositories/AuditFindingRepo";

export const userRepo = new UserRepo();
export const conversationRepo = new ConversationRepo();
export const auditFindingRepo = new AuditFindingRepo();