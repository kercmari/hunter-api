export interface ThreadIdentity {
  readonly threadId: string;
  readonly contactId?: string;
  readonly phone?: string;
}

export interface CrmPort {

  resolveThread(threadId: string): Promise<ThreadIdentity | null>;
}

export const CRM_PORT = Symbol('CrmPort');
