import apiClient from "./apiClient";

export const evaluationService = {
  // === UNIT APIs ===

  // Get evaluations list for current unit (UNIT role)
  // GET /evaluations?periodId=xxx
  getMyEvaluations: (params) => apiClient.get("/evaluations", { params }),

  // Get single evaluation detail with criteria, scores, evidences
  // GET /evaluations/:evaluationId
  getEvaluation: (evaluationId) => apiClient.get(`/evaluations/${evaluationId}`),

  // Save self-score for a criterion
  // PUT /evaluations/:evaluationId/scores/:criterionId/self
  saveSelfScore: (evaluationId, criterionId, data) =>
    apiClient.put(`/evaluations/${evaluationId}/scores/${criterionId}/self`, data),

  // Request signed upload URLs for evidence files
  // POST /evaluations/:evaluationId/evidences/upload-urls
  getUploadUrls: (evaluationId, items) =>
    apiClient.post(`/evaluations/${evaluationId}/evidences/upload-urls`, { items }),

  // Save evidence metadata (files + links)
  // POST /evaluations/:evaluationId/evidences
  saveEvidences: (evaluationId, items) =>
    apiClient.post(`/evaluations/${evaluationId}/evidences`, { items }),

  // Get evidence preview/download URL
  // GET /evaluations/:evaluationId/evidences/:evidenceId/preview
  getEvidencePreview: (evaluationId, evidenceId) =>
    apiClient.get(`/evaluations/${evaluationId}/evidences/${evidenceId}/preview`),

  // Submit supplement (UNIT submits after admin requests supplement)
  // POST /evaluations/:evaluationId/supplement-submit
  submitSupplement: (evaluationId) =>
    apiClient.post(`/evaluations/${evaluationId}/supplement-submit`, {}),

  // Get feedback thread
  // GET /evaluations/:evaluationId/feedback
  getFeedback: (evaluationId) =>
    apiClient.get(`/evaluations/${evaluationId}/feedback`),

  // Post feedback
  // POST /evaluations/:evaluationId/feedback
  postFeedback: (evaluationId, data) =>
    apiClient.post(`/evaluations/${evaluationId}/feedback`, data),

  // Get status history
  // GET /evaluations/:evaluationId/status-history
  getStatusHistory: (evaluationId) =>
    apiClient.get(`/evaluations/${evaluationId}/status-history`),

  // === ADMIN APIs ===

  // Get all evaluations for admin (with filters)
  // GET /admin/evaluations?periodId=xxx&status=xxx
  getAdminEvaluations: (params) => apiClient.get("/admin/evaluations", { params }),

  // Admin review score for a criterion
  // PUT /admin/evaluations/:evaluationId/scores/:criterionId/review
  adminReviewScore: (evaluationId, criterionId, data) =>
    apiClient.put(`/admin/evaluations/${evaluationId}/scores/${criterionId}/review`, data),

  // Admin request supplement
  // POST /admin/evaluations/:evaluationId/supplement-request
  adminRequestSupplement: (evaluationId, data) =>
    apiClient.post(`/admin/evaluations/${evaluationId}/supplement-request`, data),

  // Admin finalize evaluation
  // POST /admin/evaluations/:evaluationId/finalize
  adminFinalize: (evaluationId) =>
    apiClient.post(`/admin/evaluations/${evaluationId}/finalize`, {}),
};
