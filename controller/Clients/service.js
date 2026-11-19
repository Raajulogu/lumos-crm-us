import { Client, Project, FollowUp } from '../../models/index.js';

export const ClientService = {
  async getClients(filter, skip, limit) {
    return Client.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
  },
  async getClientById(id) {
    return Client.findById(id);
  },
  async createClient(data) {
    return Client.create(data);
  },
};
