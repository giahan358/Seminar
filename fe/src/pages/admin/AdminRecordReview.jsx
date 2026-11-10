import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card, Tag, Button, InputNumber, Input, Space, Typography, message,
  Spin, Empty, Modal, Checkbox, Divider, Timeline, Tooltip, Badge, Alert
} from "antd";
import {
  ArrowLeftOutlined, SaveOutlined, SendOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, ClockCircleOutlined, LockOutlined,
  FileImageOutlined, FilePdfOutlined, FileWordOutlined, LinkOutlined,
  EyeOutlined, TrophyOutlined, HistoryOutlined
} from "@ant-design/icons";
import { evaluationService } from "../../services/evaluationService";
import styles from "./AdminRecords.module.css";
import dayjs from "dayjs";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const STATUS_MAP = {
  DRAFT: { label: "Đang tự chấm", color: "processing", icon: <ClockCircleOutlined /> },
  PENDING_REVIEW: { label: "Chờ thẩm định", color: "warning" },
  SUPPLEMENT_REQUESTED: { label: "Yêu cầu bổ sung", color: "error", icon: <ExclamationCircleOutlined /> },
  SUPPLEMENT_SUBMITTED: { label: "Đã nộp bổ sung", color: "orange" },
  SUPPLEMENT_EXPIRED: { label: "Hết hạn bổ sung", color: "default", icon: <LockOutlined /> },
  FINALIZED: { label: "Đã chốt", color: "success", icon: <CheckCircleOutlined /> },
};

function getFileIcon(mimeType) {
  if (mimeType?.startsWith("image/")) return <FileImageOutlined style={{ color: "#1677ff" }} />;
  if (mimeType === "application/pdf") return <FilePdfOutlined style={{ color: "#cf1322" }} />;
  return <FileWordOutlined style={{ color: "#2f54eb" }} />;
}

export default function AdminRecordReview() {
  const { evaluationId } = useParams();
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [evaluation, setEvaluation] = useState(null);
  const [adminScores, setAdminScores] = useState({}); // { criterionId: { adminScore, adminComment, needsSupplement, supplementNote } }
  const [saving, setSaving] = useState(false);
  const [feedbackList, setFeedbackList] = useState([]);
  const [statusHistory, setStatusHistory] = useState([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [supplementModal, setSupplementModal] = useState(false);
  const [supplementCriteria, setSupplementCriteria] = useState([]);
  const [supplementContent, setSupplementContent] = useState("");
  const [finalizeModal, setFinalizeModal] = useState(false);
  const [previewModal, setPreviewModal] = useState({ open: false, url: "", title: "" });
  const [showHistory, setShowHistory] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const evalData = await evaluationService.getEvaluation(evaluationId);
      setEvaluation(evalData);

      // Init admin scores from evaluation data
      const scores = {};
      (evalData?.criteria || []).forEach((c) => {
        scores[c.criterionId] = {
          adminScore: c.adminScore ?? c.selfScore ?? 0,
          adminComment: c.adminComment || "",
          needsSupplement: c.needsSupplement || false,
          supplementNote: c.supplementNote || "",
        };
      });
      setAdminScores(scores);

      // Load feedback
      try {
        const fbRes = await evaluationService.getFeedback(evaluationId);
        setFeedbackList(fbRes?.items || []);
      } catch { /* ok */ }

      // Load status history
      try {
        const histRes = await evaluationService.getStatusHistory(evaluationId);
        setStatusHistory(histRes?.items || []);
      } catch { /* ok */ }
    } catch (err) {
      message.error(err?.message || "Lỗi tải hồ sơ");
    } finally {
      setLoading(false);
    }
  }, [evaluationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Computed
  const status = evaluation?.status || "DRAFT";
  const statusConf = STATUS_MAP[status] || { label: status, color: "default" };
  const criteria = evaluation?.criteria || [];
  const canReview = ["PENDING_REVIEW", "SUPPLEMENT_SUBMITTED", "SUPPLEMENT_EXPIRED"].includes(status);
  const canRequestSupplement = status === "PENDING_REVIEW" || status === "SUPPLEMENT_SUBMITTED";
  const canFinalize = canReview;
  const isFinalized = status === "FINALIZED";

  const totalMaxScore = criteria.reduce((s, c) => s + (c.maxScore || 0), 0);
  const totalSelfScore = criteria.reduce((s, c) => s + (c.selfScore || 0), 0);
  const totalAdminScore = criteria.reduce((s, c) => s + (adminScores[c.criterionId]?.adminScore || 0), 0);

  // Handlers
  const handleAdminScoreChange = (criterionId, field, value) => {
    setAdminScores((prev) => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], [field]: value },
    }));
  };

  const handleSaveReview = async (criterionId) => {
    if (!evaluationId) return;
    const data = adminScores[criterionId];
    if (!data) return;

    // Validate: comment required if score differs
    const criterion = criteria.find((c) => c.criterionId === criterionId);
    if (criterion && data.adminScore !== criterion.selfScore && !data.adminComment?.trim()) {
      message.warning("Vui lòng nhập lý do khi điều chỉnh điểm khác điểm tự chấm.");
      return;
    }

    try {
      setSaving(true);
      await evaluationService.adminReviewScore(evaluationId, criterionId, {
        adminScore: data.adminScore,
        adminComment: data.adminComment,
        needsSupplement: data.needsSupplement,
        supplementNote: data.needsSupplement ? data.supplementNote : undefined,
      });
      message.success("Đã lưu điểm thẩm định!");
    } catch (err) {
      message.error(err?.message || "Lỗi lưu điểm");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAllReview = async () => {
    try {
      setSaving(true);
      const promises = Object.entries(adminScores).map(([criterionId, data]) => {
        const criterion = criteria.find((c) => c.criterionId === criterionId);
        if (criterion && data.adminScore !== criterion.selfScore && !data.adminComment?.trim()) {
          return Promise.reject(new Error(`Tiêu chí ${criterion.code}: Cần nhập lý do khi điểm khác`));
        }
        return evaluationService.adminReviewScore(evaluationId, criterionId, {
          adminScore: data.adminScore,
          adminComment: data.adminComment,
          needsSupplement: data.needsSupplement,
          supplementNote: data.needsSupplement ? data.supplementNote : undefined,
        });
      });
      await Promise.all(promises);
      message.success("Đã lưu tất cả điểm thẩm định!");
      await loadData();
    } catch (err) {
      message.error(err?.message || "Lỗi lưu điểm");
    } finally {
      setSaving(false);
    }
  };

  // Request supplement
  const handleRequestSupplement = async () => {
    if (supplementCriteria.length === 0) {
      message.warning("Vui lòng chọn ít nhất 1 tiêu chí cần bổ sung.");
      return;
    }
    if (!supplementContent.trim()) {
      message.warning("Vui lòng nhập nội dung yêu cầu bổ sung.");
      return;
    }
    try {
      await evaluationService.adminRequestSupplement(evaluationId, {
        criterionIds: supplementCriteria,
        content: supplementContent.trim(),
      });
      message.success("Đã gửi yêu cầu bổ sung!");
      setSupplementModal(false);
      setSupplementCriteria([]);
      setSupplementContent("");
      await loadData();
    } catch (err) {
      message.error(err?.message || "Lỗi gửi yêu cầu bổ sung");
    }
  };

  // Finalize
  const handleFinalize = async () => {
    try {
      await evaluationService.adminFinalize(evaluationId);
      message.success("Đã chốt hồ sơ thành công!");
      setFinalizeModal(false);
      await loadData();
    } catch (err) {
      message.error(err?.message || "Lỗi chốt hồ sơ");
    }
  };

  // Feedback
  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) return;
    try {
      setSendingFeedback(true);
      await evaluationService.postFeedback(evaluationId, {
        type: "ADMIN_COMMENT",
        content: feedbackText.trim(),
      });
      message.success("Đã gửi nhận xét!");
      setFeedbackText("");
      const fbRes = await evaluationService.getFeedback(evaluationId);
      setFeedbackList(fbRes?.items || []);
    } catch (err) {
      message.error(err?.message || "Lỗi gửi nhận xét");
    } finally {
      setSendingFeedback(false);
    }
  };

  // Preview
  const handlePreview = async (evidenceId, fileName) => {
    try {
      const res = await evaluationService.getEvidencePreview(evaluationId, evidenceId);
      if (res?.url) {
        setPreviewModal({ open: true, url: res.url, title: fileName });
      } else if (res?.downloadUrl) {
        window.open(res.downloadUrl, "_blank");
      }
    } catch {
      message.error("Không thể xem trước file");
    }
  };

  // Loading
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <Spin size="large" tip="Đang tải hồ sơ..." />
      </div>
    );
  }

  if (!evaluation) {
    return <Empty description="Không tìm thấy hồ sơ" />;
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.reviewContainer}>
        {/* === HEADER === */}
        <div className={styles.reviewHeader}>
          <div>
            <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate("/admin/records")} style={{ padding: 0, marginBottom: 8 }}>
              Quay lại danh sách
            </Button>
            <Title level={4} style={{ margin: 0 }}>
              {evaluation.unit?.name || "Hồ sơ"}
              <Tag color={statusConf.color} style={{ marginLeft: 12, verticalAlign: "middle" }}>
                {statusConf.label}
              </Tag>
            </Title>
            <Text type="secondary">Mã đơn vị: {evaluation.unit?.code} — ID: {evaluation.id?.slice(0, 8)}</Text>
          </div>
          <Space>
            <Button icon={<HistoryOutlined />} onClick={() => setShowHistory(!showHistory)}>
              Lịch sử
            </Button>
            {canRequestSupplement && (
              <Button type="default" danger icon={<ExclamationCircleOutlined />} onClick={() => setSupplementModal(true)}>
                Yêu cầu bổ sung
              </Button>
            )}
            {canFinalize && (
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => setFinalizeModal(true)} style={{ borderRadius: 8 }}>
                Chốt hồ sơ
              </Button>
            )}
          </Space>
        </div>

        {/* Supplement deadline alert */}
        {evaluation.supplementDeadline && (
          <Alert
            type="warning"
            showIcon
            message={`Đã yêu cầu bổ sung — Hạn: ${dayjs(evaluation.supplementDeadline).format("DD/MM/YYYY HH:mm")}`}
            style={{ borderRadius: 8 }}
          />
        )}

        {/* Score summary */}
        <div className={styles.statsRow}>
          <Card className={styles.statCard}>
            <div className={styles.statLabel}>Tổng điểm tối đa</div>
            <div className={styles.statValue}>{totalMaxScore}</div>
          </Card>
          <Card className={styles.statCard}>
            <div className={styles.statLabel}>Tự chấm</div>
            <div className={styles.statValue} style={{ color: "#1677ff" }}>{totalSelfScore}</div>
          </Card>
          <Card className={styles.statCard}>
            <div className={styles.statLabel}>Admin chấm</div>
            <div className={styles.statValue} style={{ color: "#722ed1" }}>{totalAdminScore}</div>
          </Card>
          <Card className={styles.statCard}>
            <div className={styles.statLabel}>Chênh lệch</div>
            <div className={styles.statValue} style={{ color: totalAdminScore < totalSelfScore ? "#cf1322" : "#52c41a" }}>
              {totalAdminScore - totalSelfScore >= 0 ? "+" : ""}{totalAdminScore - totalSelfScore}
            </div>
          </Card>
          <Card className={styles.statCard}>
            <div className={styles.statLabel}>Tỷ lệ Admin</div>
            <div className={styles.statValue}>
              {totalMaxScore > 0 ? (totalAdminScore / totalMaxScore * 100).toFixed(1) : 0}%
            </div>
          </Card>
        </div>

        {/* === STATUS HISTORY (togglable) === */}
        {showHistory && statusHistory.length > 0 && (
          <Card title="Lịch sử trạng thái" size="small" style={{ borderRadius: 12, marginBottom: 16 }}>
            <Timeline
              items={statusHistory.map((h) => ({
                color: h.toStatus === "FINALIZED" ? "green" : h.toStatus?.includes("SUPPLEMENT") ? "red" : "blue",
                children: (
                  <div>
                    <Tag>{h.fromStatus}</Tag> → <Tag>{h.toStatus}</Tag>
                    {h.comment && <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>{h.comment}</div>}
                    <div style={{ fontSize: 12, color: "#999" }}>
                      {h.actorId ? `Người thực hiện: ${h.actorId.slice(0, 8)}` : "Hệ thống"} — {dayjs(h.createdAt).format("DD/MM/YYYY HH:mm")}
                    </div>
                  </div>
                ),
              }))}
            />
          </Card>
        )}

        {/* === SIDE-BY-SIDE REVIEW GRID === */}
        <div className={styles.reviewGrid}>
          <div className={styles.reviewGridHeader}>
            <div>Mã</div>
            <div>Tiêu chí</div>
            <div style={{ textAlign: "center" }}>Tối đa</div>
            <div>Tự chấm + Diễn giải</div>
            <div>Minh chứng</div>
            <div>Điểm Admin + Nhận xét</div>
            <div style={{ textAlign: "center" }}>Thao tác</div>
          </div>

          {criteria.map((c) => {
            const cId = c.criterionId;
            const edited = adminScores[cId] || {};
            const scoreDiff = (edited.adminScore || 0) - (c.selfScore || 0);

            return (
              <div key={cId} className={styles.reviewGridRow}>
                {/* Code */}
                <div>
                  <span className={styles.colCode}>{c.code}</span>
                </div>

                {/* Name */}
                <div className={styles.colName}>
                  {c.name}
                  {c.needsSupplement && (
                    <div><span className={styles.supplementTag}>Cần bổ sung</span></div>
                  )}
                </div>

                {/* Max score */}
                <div className={styles.colMax}>{c.maxScore}</div>

                {/* Self score + note */}
                <div className={styles.colSelfScore}>
                  <div className={styles.colSelfScoreValue}>{c.selfScore ?? "—"}</div>
                  {c.selfNote && (
                    <Tooltip title={c.selfNote}>
                      <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                        {c.selfNote}
                      </Text>
                    </Tooltip>
                  )}
                </div>

                {/* Evidences */}
                <div className={styles.colEvidences}>
                  {(c.evidences || []).length === 0 && (
                    <Text type="secondary" style={{ fontSize: 12 }}>Không có</Text>
                  )}
                  {(c.evidences || []).map((ev) => (
                    <Tooltip key={ev.id} title={ev.description || ev.fileName || ev.externalUrl}>
                      <span
                        className={styles.evidenceChip}
                        onClick={() => {
                          if (ev.kind === "LINK") {
                            window.open(ev.externalUrl, "_blank");
                          } else {
                            handlePreview(ev.id, ev.fileName);
                          }
                        }}
                      >
                        {ev.kind === "LINK" ? <LinkOutlined /> : getFileIcon(ev.mimeType)}
                        {ev.kind === "LINK" ? "Link" : (ev.fileName?.length > 12 ? ev.fileName.slice(0, 12) + "..." : ev.fileName)}
                        {ev.round === "SUPPLEMENT" && <Badge status="warning" />}
                      </span>
                    </Tooltip>
                  ))}
                </div>

                {/* Admin score + comment */}
                <div className={styles.colAdminScore}>
                  <InputNumber
                    min={0}
                    max={c.maxScore}
                    value={edited.adminScore}
                    onChange={(val) => handleAdminScoreChange(cId, "adminScore", val)}
                    disabled={!canReview}
                    size="small"
                    style={{ width: "100%" }}
                  />
                  {scoreDiff !== 0 && (
                    <Tag color={scoreDiff < 0 ? "red" : "green"} style={{ fontSize: 11 }}>
                      {scoreDiff > 0 ? "+" : ""}{scoreDiff}
                    </Tag>
                  )}
                  <Input.TextArea
                    rows={1}
                    value={edited.adminComment}
                    onChange={(e) => handleAdminScoreChange(cId, "adminComment", e.target.value)}
                    disabled={!canReview}
                    placeholder="Nhận xét..."
                    style={{ fontSize: 12, marginTop: 4 }}
                    autoSize={{ minRows: 1, maxRows: 3 }}
                  />
                </div>

                {/* Actions */}
                <div className={styles.colActions}>
                  {canReview && (
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      icon={<SaveOutlined />}
                      onClick={() => handleSaveReview(cId)}
                      loading={saving}
                    >
                      Lưu
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* === ACTION BAR === */}
        {canReview && (
          <div className={styles.actionBar}>
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              onClick={handleSaveAllReview}
              loading={saving}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Lưu tất cả điểm thẩm định
            </Button>
          </div>
        )}

        {/* === FEEDBACK PANEL === */}
        <div className={styles.feedbackPanel}>
          <Title level={5} style={{ margin: "0 0 16px 0" }}>Trao đổi với đơn vị</Title>

          {feedbackList.length === 0 && (
            <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>Chưa có trao đổi nào.</Text>
          )}

          {feedbackList.map((fb) => (
            <div
              key={fb.id}
              className={`${styles.feedbackItem} ${
                fb.type === "UNIT_REPLY" ? styles.feedbackUnit :
                fb.type === "ADMIN_COMMENT" ? styles.feedbackAdmin :
                styles.feedbackSystem
              }`}
            >
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                {fb.type === "UNIT_REPLY" ? "Đơn vị" : fb.type === "ADMIN_COMMENT" ? "Admin" : "Hệ thống"}
              </div>
              <div style={{ fontSize: 14, color: "#333" }}>{fb.content}</div>
              <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                {dayjs(fb.createdAt).format("DD/MM/YYYY HH:mm")}
              </div>
            </div>
          ))}

          {/* Reply */}
          {!isFinalized && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <TextArea
                rows={2}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Nhập nhận xét, phản hồi cho đơn vị..."
                style={{ borderRadius: 8 }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSendFeedback}
                loading={sendingFeedback}
                disabled={!feedbackText.trim()}
                style={{ borderRadius: 8, height: "auto" }}
              >
                Gửi
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* === SUPPLEMENT REQUEST MODAL === */}
      <Modal
        title="Yêu cầu bổ sung minh chứng"
        open={supplementModal}
        onOk={handleRequestSupplement}
        onCancel={() => setSupplementModal(false)}
        okText="Gửi yêu cầu"
        cancelText="Hủy"
        width={600}
      >
        <div style={{ marginTop: 16 }}>
          <Text strong>Chọn tiêu chí cần bổ sung:</Text>
          <div style={{ marginTop: 8, maxHeight: 300, overflowY: "auto" }}>
            <Checkbox.Group
              value={supplementCriteria}
              onChange={setSupplementCriteria}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              {criteria.map((c) => (
                <Checkbox key={c.criterionId} value={c.criterionId}>
                  <strong>{c.code}</strong> — {c.name}
                </Checkbox>
              ))}
            </Checkbox.Group>
          </div>
          <Divider />
          <Text strong>Nội dung yêu cầu:</Text>
          <TextArea
            rows={3}
            value={supplementContent}
            onChange={(e) => setSupplementContent(e.target.value)}
            placeholder="Nhập lý do yêu cầu bổ sung..."
            style={{ marginTop: 8, borderRadius: 8 }}
          />
        </div>
      </Modal>

      {/* === FINALIZE MODAL === */}
      <Modal
        title="Xác nhận chốt hồ sơ"
        open={finalizeModal}
        onOk={handleFinalize}
        onCancel={() => setFinalizeModal(false)}
        okText="Xác nhận chốt"
        okType="primary"
        cancelText="Hủy"
      >
        <Alert
          type="warning"
          showIcon
          style={{ borderRadius: 8 }}
          message="Sau khi chốt, hồ sơ sẽ không thể chỉnh sửa. Điểm và xếp loại sẽ được công bố chính thức."
        />
        <div style={{ marginTop: 16 }}>
          <div>Đơn vị: <strong>{evaluation.unit?.name}</strong></div>
          <div>Tổng điểm Admin: <strong>{totalAdminScore}/{totalMaxScore}</strong></div>
          <div>Tỷ lệ: <strong>{totalMaxScore > 0 ? (totalAdminScore / totalMaxScore * 100).toFixed(1) : 0}%</strong></div>
        </div>
      </Modal>

      {/* === PREVIEW MODAL === */}
      <Modal
        title={previewModal.title}
        open={previewModal.open}
        onCancel={() => setPreviewModal({ open: false, url: "", title: "" })}
        footer={null}
        width={800}
      >
        {previewModal.url && (
          previewModal.url.match(/\.(jpg|jpeg|png|gif)$/i) || previewModal.title?.match(/\.(jpg|jpeg|png|gif)$/i)
            ? <img src={previewModal.url} alt={previewModal.title} style={{ width: "100%", borderRadius: 8 }} />
            : <iframe src={previewModal.url} style={{ width: "100%", height: 500, border: "none", borderRadius: 8 }} title={previewModal.title} />
        )}
      </Modal>
    </div>
  );
}
