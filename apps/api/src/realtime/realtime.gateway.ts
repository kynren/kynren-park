import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

/**
 * Realtime hub. Clients join a room per visit date (e.g. "date:2026-07-18")
 * so a schedule change only fans out to guests who are there that day.
 */
@Injectable()
@WebSocketGateway({ cors: { origin: '*' } })
export class RealtimeGateway {
  @WebSocketServer() server!: Server;

  @SubscribeMessage('join')
  handleJoin(@MessageBody() body: { date?: string }, @ConnectedSocket() client: Socket) {
    if (body?.date) client.join(`date:${body.date}`);
    client.join('all');
    return { ok: true };
  }

  /** Broadcast to everyone (announcements) or to a specific date room. */
  emit(event: string, payload: unknown, date?: string) {
    const room = date ? `date:${date}` : 'all';
    this.server?.to(room).emit(event, payload);
  }
}
