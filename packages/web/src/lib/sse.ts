interface Writer {
  write(data: string): void;
}

export class SSEManager {
  private connections = new Map<string, Set<Writer>>();

  register(agentId: string, writer: Writer): void {
    if (!this.connections.has(agentId)) {
      this.connections.set(agentId, new Set());
    }
    this.connections.get(agentId)!.add(writer);
  }

  unregister(agentId: string, writer: Writer): void {
    this.connections.get(agentId)?.delete(writer);
  }

  broadcast(agentId: string, data: any): void {
    const writers = this.connections.get(agentId);
    if (!writers) return;
    const message = `data: ${JSON.stringify(data)}\n\n`;
    for (const writer of writers) {
      try {
        writer.write(message);
      } catch {
        writers.delete(writer);
      }
    }
  }
}

export const sseManager = new SSEManager();
