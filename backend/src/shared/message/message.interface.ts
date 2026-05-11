export interface DomainEvent {
  eventId: string;
  eventType: string;
  tenantId: string;
  sourceModule: string;
  targetModule?: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface MessageService {
  publish(event: DomainEvent): Promise<void>;
  subscribe(
    eventType: string,
    handler: (event: DomainEvent) => Promise<void>,
  ): void;
}

export const MESSAGE_SERVICE = 'MESSAGE_SERVICE';
