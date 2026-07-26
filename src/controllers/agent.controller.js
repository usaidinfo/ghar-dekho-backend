import { success, error, paginated } from '../utils/response.js';
import { getPagination } from '../utils/pagination.js';
import * as agentService from '../services/agent/agent.service.js';

function handleAgentError(res, err, fallbackMessage) {
  console.error(fallbackMessage, err);
  if (err.status && err.code) {
    return res.status(err.status).json(error(err.message, null, err.code));
  }
  if (err.status) {
    return res.status(err.status).json(error(err.message || fallbackMessage));
  }
  return res.status(500).json(error(fallbackMessage));
}


export const getDashboard = async (req, res) => {
  try {
    const data = await agentService.getDashboard(req.user.id, req.agentProfile);
    return res.json(success(data));
  } catch (err) {
    return handleAgentError(res, err, 'Failed to load agent dashboard.');
  }
};


export const getLeads = async (req, res) => {
  try {
    const { page, limit } = getPagination(req.query);
    const stage = req.query.stage ? String(req.query.stage).toUpperCase() : null;
    const result = await agentService.listLeads(req.user.id, req.agentProfile, {
      stage,
      page,
      limit,
    });
    return res.json(paginated(result.leads, result.total, page, limit));
  } catch (err) {
    return handleAgentError(res, err, 'Failed to load leads.');
  }
};


export const getLeadById = async (req, res) => {
  try {
    const data = await agentService.getLeadDetail(
      req.user.id,
      req.agentProfile,
      req.params.id,
    );
    return res.json(success(data));
  } catch (err) {
    return handleAgentError(res, err, 'Failed to load lead.');
  }
};


export const patchLead = async (req, res) => {
  try {
    const data = await agentService.updateLead(
      req.user.id,
      req.agentProfile,
      req.params.id,
      req.body || {},
    );
    return res.json(success(data, 'Lead updated.'));
  } catch (err) {
    return handleAgentError(res, err, 'Failed to update lead.');
  }
};


export const getListings = async (req, res) => {
  try {
    const { page, limit } = getPagination(req.query);
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;
    const result = await agentService.listListings(req.user.id, {
      status,
      page,
      limit,
    });
    return res.json(
      success(result.listings, 'OK', {
        ...paginated(result.listings, result.total, page, limit).meta,
        summary: result.summary,
      }),
    );
  } catch (err) {
    return handleAgentError(res, err, 'Failed to load listings.');
  }
};


export const getListingPerformance = async (req, res) => {
  try {
    const data = await agentService.getListingPerformance(
      req.user.id,
      req.agentProfile,
      req.params.id,
      { period: req.query.period },
    );
    return res.json(success(data));
  } catch (err) {
    return handleAgentError(res, err, 'Failed to load listing performance.');
  }
};


export const getAnalytics = async (req, res) => {
  try {
    const data = await agentService.getAnalytics(req.user.id, req.agentProfile, {
      period: req.query.period,
    });
    return res.json(success(data));
  } catch (err) {
    return handleAgentError(res, err, 'Failed to load analytics.');
  }
};


export const getTeam = async (req, res) => {
  try {
    const data = await agentService.getTeam(req.user.id, req.agentProfile);
    return res.json(success(data));
  } catch (err) {
    return handleAgentError(res, err, 'Failed to load team.');
  }
};


export const createTeamMember = async (req, res) => {
  try {
    const data = await agentService.addTeamMember(
      req.user.id,
      req.agentProfile,
      req.body || {},
    );
    return res.status(201).json(success(data, 'Team member added.'));
  } catch (err) {
    return handleAgentError(res, err, 'Failed to add team member.');
  }
};


export const patchTeamMember = async (req, res) => {
  try {
    const data = await agentService.updateTeamMember(
      req.user.id,
      req.agentProfile,
      req.params.id,
      req.body || {},
    );
    return res.json(success(data, 'Team member updated.'));
  } catch (err) {
    return handleAgentError(res, err, 'Failed to update team member.');
  }
};


export const deleteTeamMember = async (req, res) => {
  try {
    const data = await agentService.removeTeamMember(
      req.user.id,
      req.agentProfile,
      req.params.id,
    );
    return res.json(success(data, 'Team member removed.'));
  } catch (err) {
    return handleAgentError(res, err, 'Failed to remove team member.');
  }
};


export const getAgencyProfile = async (req, res) => {
  try {
    const data = await agentService.getAgencyProfile(req.user.id, req.agentProfile);
    return res.json(success(data));
  } catch (err) {
    return handleAgentError(res, err, 'Failed to load agency profile.');
  }
};


export const patchAgencyProfile = async (req, res) => {
  try {
    const data = await agentService.updateAgencyProfile(
      req.user.id,
      req.agentProfile,
      req.body || {},
    );
    return res.json(success(data, 'Agency profile updated.'));
  } catch (err) {
    return handleAgentError(res, err, 'Failed to update agency profile.');
  }
};
