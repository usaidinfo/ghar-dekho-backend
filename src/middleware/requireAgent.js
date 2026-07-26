import { error } from '../utils/response.js';
import prisma from '../config/database.js';

const AGENT_PROFILE_TYPES = new Set(['AGENT', 'BROKER', 'BUILDER']);

export const requireAgent = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json(error('Please log in first.', null, 'UNAUTHORIZED'));
    }

    const isAgentRole = req.user.role === 'AGENT';
    const isAgentType = AGENT_PROFILE_TYPES.has(req.user.profileType);

    if (!isAgentRole && !isAgentType) {
      return res.status(403).json(
        error('Agent dashboard is only available for agents, brokers, and builders.', null, 'NOT_AGENT'),
      );
    }

    const agentProfile = await prisma.agentProfile.upsert({
      where: { userId: req.user.id },
      update: {},
      create: { userId: req.user.id },
    });

    req.agentProfile = agentProfile;
    next();
  } catch (err) {
    console.error('requireAgent error:', err);
    return res.status(500).json(error('Failed to verify agent access.'));
  }
};
