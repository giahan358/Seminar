import { useState, useEffect, useCallback } from "react";
import {
  Card,
  Tag,
  InputNumber,
  Input,
  Button,
  message,
  Space,
  Typography,
  Upload,
  Modal,
  Tooltip,
  Divider,
  Empty,
  Spin,
  Statistic,
  Alert,
  Badge,
} from "antd";
import {
  SaveOutlined,
  UploadOutlined,
  LinkOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  EyeOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  LockOutlined,
  ExclamationCircleOutlined,
  SendOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { useAuth } from "../../contexts/AuthContext";
import { evaluationService } from "../../services/evaluationService";
import { evaluationPeriodService } from "../../services/evaluationPeriodService";
import styles from "./UnitEvaluation.module.css";
import dayjs from "dayjs";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Countdown } = Statistic;

// === STATUS HELPERS ===
const STATUS_CONFIG = {
  DRAFT: {
    label: "Đang tự chấm",
    color: "processing",
    icon: <ClockCircleOutlined />,
    bannerClass: "statusBannerDraft",
  },
  PENDING_REVIEW: {
    label: "Chờ thẩm định",
    color: "warning",
    icon: <LockOutlined />,
    bannerClass: "statusBannerLocked",
  },
  SUPPLEMENT_REQUESTED: {
    label: "Yêu cầu bổ sung",
    color: "error",
    icon: <ExclamationCircleOutlined />,
    bannerClass: "statusBannerSupplement",
  },
  SUPPLEMENT_SUBMITTED: {
    label: "Đã nộp bổ sung",
    color: "warning",
    icon: <ClockCircleOutlined />,
    bannerClass: "statusBannerLocked",
  },
  SUPPLEMENT_EXPIRED: {
    label: "Hết hạn bổ sung",
    color: "default",
    icon: <LockOutlined />,
    bannerClass: "statusBannerLocked",
  },
  FINALIZED: {
    label: "Đã chốt điểm",
    color: "success",
    icon: <CheckCircleOutlined />,
    bannerClass: "statusBannerFinalized",
  },
};

const CLASSIFICATION_LABELS = {
  EXCELLENT: "Xuất sắc",
  GOOD: "Tốt",
  FAIR: "Khá",
  AVERAGE: "Trung bình",
  POOR: "Yếu",
};

// File icon helper
function getFileIcon(mimeType) {
  if (mimeType?.startsWith("image/")) return <FileImageOutlined style={{ color: "#1677ff" }} />;
  if (mimeType === "application/pdf") return <FilePdfOutlined style={{ color: "#cf1322" }} />;
  return <FileWordOutlined style={{ color: "#2f54eb" }} />;
}

export default function UnitEvaluation() {
  const { user } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [editedScores, setEditedScores] = useState({}); // { criterionId: { selfScore, selfNote } }
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [previewModal, setPreviewModal] = useState({ open: false, url: "", title: "" });
  const [uploadModalCriterion, setUploadModalCriterion] = useState(null);
  const [linkModalCriterion, setLinkModalCriterion] = useState(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDesc, setLinkDesc] = useState("");

  // === DATA LOADING ===
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Get current period
      const periodsRes = await evaluationPeriodService.getEvaluationPeriods();
      const periods = periodsRes?.items || [];
      const currentPeriod = periods[0]; // Most recent
      if (!currentPeriod) {
        setPeriod(null);
        setEvaluation(null);
        return;
      }
      setPeriod(currentPeriod);

      // Get my evaluation for this period
      const evalRes = await evaluationService.getMyEvaluations({ periodId: currentPeriod.id });
      const evals = evalRes?.items || [];
      if (evals.length > 0) {
        const evalDetail = await evaluationService.getEvaluation(evals[0].id);
        setEvaluation(evalDetail);

        // Init edited scores from evaluation data
        const scores = {};
        (evalDetail?.criteria || []).forEach((c) => {
          scores[c.criterionId] = {
            selfScore: c.selfScore,
            selfNote: c.selfNote || "",
          };
        });
        setEditedScores(scores);

        // Load feedback
        try {
          const fbRes = await evaluationService.getFeedback(evals[0].id);
          setFeedbackList(fbRes?.items || []);
        } catch {
          /* feedback may not exist yet */
        }
      }
    } catch (err) {
      message.error(err?.message || "Lỗi tải dữ liệu hồ sơ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // === COMPUTED ===
  const status = evaluation?.status || "DRAFT";
  const statusConf = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  const isEditable = status === "DRAFT";
  const isSupplementable = status === "SUPPLEMENT_REQUESTED";
  const isFinalized = status === "FINALIZED";
  const criteria = evaluation?.criteria || [];

  // Supplement deadline
  const supplementDeadline = evaluation?.supplementDeadline
    ? dayjs(evaluation.supplementDeadline)
    : null;
  const supplementExpired = supplementDeadline && dayjs().isAfter(supplementDeadline);

  // Calculate totals
  const totalSelfScore = criteria.reduce(
    (sum, c) => sum + (editedScores[c.criterionId]?.selfScore || 0),
    0,
  );
  const totalMaxScore = criteria.reduce((sum, c) => sum + (c.maxScore || 0), 0);
  const totalAdminScore = criteria.reduce((sum, c) => sum + (c.adminScore ?? c.selfScore ?? 0), 0);
  const percent =
    totalMaxScore > 0
      ? (((isFinalized ? totalAdminScore : totalSelfScore) / totalMaxScore) * 100).toFixed(1)
      : 0;

  // Classification
  function getClassification(pct) {
    if (pct >= 90) return "EXCELLENT";
    if (pct >= 80) return "GOOD";
    if (pct >= 65) return "FAIR";
    if (pct >= 50) return "AVERAGE";
    return "POOR";
  }
  const classification = getClassification(percent);

  // === HANDLERS ===
  const handleScoreChange = (criterionId, field, value) => {
    setEditedScores((prev) => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], [field]: value },
    }));
  };

  const handleSaveAll = async () => {
    if (!evaluation?.id) return;
    try {
      setSaving(true);
      const promises = Object.entries(editedScores).map(([criterionId, data]) =>
        evaluationService.saveSelfScore(evaluation.id, criterionId, {
          selfScore: data.selfScore,
          selfNote: data.selfNote,
        }),
      );
      await Promise.all(promises);
      message.success("Đã lưu điểm tự chấm thành công!");
      await loadData();
    } catch (err) {
      message.error(err?.message || "Lỗi lưu điểm");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSingleScore = async (criterionId) => {
    if (!evaluation?.id) return;
    const data = editedScores[criterionId];
    if (!data) return;
    try {
      await evaluationService.saveSelfScore(evaluation.id, criterionId, {
        selfScore: data.selfScore,
        selfNote: data.selfNote,
      });
      message.success("Đã lưu!");
    } catch (err) {
      message.error(err?.message || "Lỗi lưu điểm");
    }
  };

  // Evidence link
  const handleAddLink = async () => {
    if (!linkUrl || !linkModalCriterion || !evaluation?.id) return;
    try {
      await evaluationService.saveEvidences(evaluation.id, [
        {
          kind: "LINK",
          criterionScoreId: linkModalCriterion,
          externalUrl: linkUrl,
          round: isSupplementable ? "SUPPLEMENT" : "INITIAL",
          description: linkDesc || "",
        },
      ]);
      message.success("Đã thêm link minh chứng!");
      setLinkModalCriterion(null);
      setLinkUrl("");
      setLinkDesc("");
      await loadData();
    } catch (err) {
      message.error(err?.message || "Lỗi thêm link");
    }
  };

  // File upload
  const handleFileUpload = async (file, criterionScoreId) => {
    if (!evaluation?.id) return false;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      message.error("File quá lớn (tối đa 10MB)");
      return false;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type)) {
      message.error("Định dạng không hỗ trợ. Chỉ chấp nhận JPG, PNG, PDF, Word.");
      return false;
    }

    try {
      // Get signed upload URL
      const urlRes = await evaluationService.getUploadUrls(evaluation.id, [
        {
          criterionScoreId,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          round: isSupplementable ? "SUPPLEMENT" : "INITIAL",
        },
      ]);

      const uploadInfo = urlRes?.items?.[0];
      if (!uploadInfo?.uploadUrl) {
        message.error("Không lấy được URL upload");
        return false;
      }

      // Upload file to signed URL
      await fetch(uploadInfo.uploadUrl, {
        method: uploadInfo.method || "PUT",
        headers: uploadInfo.requiredHeaders || { "Content-Type": file.type },
        body: file,
      });

      // Save evidence metadata
      await evaluationService.saveEvidences(evaluation.id, [
        {
          kind: "FILE",
          criterionScoreId,
          storagePath: uploadInfo.storagePath,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          round: isSupplementable ? "SUPPLEMENT" : "INITIAL",
          description: file.name,
        },
      ]);

      message.success(`Đã upload: ${file.name}`);
      await loadData();
    } catch (err) {
      message.error(err?.message || `Lỗi upload: ${file.name}`);
    }
    return false; // prevent antd default upload
  };

  // Preview evidence
  const handlePreview = async (evidenceId, fileName) => {
    if (!evaluation?.id) return;
    try {
      const res = await evaluationService.getEvidencePreview(evaluation.id, evidenceId);
      if (res?.url) {
        setPreviewModal({ open: true, url: res.url, title: fileName });
      } else {
        window.open(res?.downloadUrl, "_blank");
      }
    } catch {
      message.error("Không thể xem trước file này");
    }
  };

  // Submit supplement
  const handleSubmitSupplement = async () => {
    if (!evaluation?.id) return;
    try {
      await evaluationService.submitSupplement(evaluation.id);
      message.success("Đã nộp bổ sung thành công!");
      await loadData();
    } catch (err) {
      message.error(err?.message || "Lỗi nộp bổ sung");
    }
  };

  // Send feedback
  const handleSendFeedback = async () => {
    if (!feedbackText.trim() || !evaluation?.id) return;
    try {
      setSendingFeedback(true);
      await evaluationService.postFeedback(evaluation.id, {
        type: "UNIT_REPLY",
        content: feedbackText.trim(),
      });
      message.success("Đã gửi phản hồi!");
      setFeedbackText("");
      const fbRes = await evaluationService.getFeedback(evaluation.id);
      setFeedbackList(fbRes?.items || []);
    } catch (err) {
      message.error(err?.message || "Lỗi gửi phản hồi");
    } finally {
      setSendingFeedback(false);
    }
  };

  // === LOADING STATE ===
  if (loading) {
    return (
      <div
        style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <Spin size="large" tip="Đang tải hồ sơ thi đua..." />
      </div>
    );
  }

  // === NO PERIOD ===
  if (!period) {
    return <Empty description="Chưa có kỳ thi đua nào được mở. Vui lòng liên hệ Admin." />;
  }

  // === NO EVALUATION ===
  if (!evaluation) {
    return <Empty description="Chưa có hồ sơ thi đua cho kỳ hiện tại. Vui lòng liên hệ Admin." />;
  }

  // === RENDER ===
  return (
    <div className={styles.pageContainer}>
      {/* === PERIOD INFO === */}
      <div className={styles.infoBar}>
        <Card className={styles.infoCard}>
          <div className={styles.infoLabel}>Kỳ thi đua</div>
          <div className={styles.infoValueSmall}>{period.name}</div>
        </Card>
        <Card className={styles.infoCard}>
          <div className={styles.infoLabel}>Đơn vị</div>
          <div className={styles.infoValueSmall}>{evaluation.unit?.name || user?.fullName}</div>
        </Card>
        <Card className={styles.infoCard}>
          <div className={styles.infoLabel}>Tổng điểm tự chấm</div>
          <div className={styles.infoValue}>
            {totalSelfScore}{" "}
            <span style={{ fontSize: 14, color: "#999", fontWeight: 400 }}>/ {totalMaxScore}</span>
          </div>
        </Card>
        <Card className={styles.infoCard}>
          <div className={styles.infoLabel}>Tỷ lệ</div>
          <div className={styles.infoValue}>{percent}%</div>
        </Card>
        <Card className={styles.infoCard}>
          <div className={styles.infoLabel}>Xếp loại (tạm tính)</div>
          <div className={styles.infoValue}>
            <Tag
              color={
                classification === "EXCELLENT"
                  ? "green"
                  : classification === "GOOD"
                    ? "blue"
                    : classification === "FAIR"
                      ? "gold"
                      : "default"
              }>
              {CLASSIFICATION_LABELS[classification] || classification}
            </Tag>
          </div>
        </Card>
      </div>

      {/* === STATUS BANNER === */}
      <div className={`${styles.statusBanner} ${styles[statusConf.bannerClass]}`}>
        {statusConf.icon}
        <div>
          <strong>Trạng thái:</strong> {statusConf.label}
          {isEditable && period.selfEvalDeadline && (
            <span style={{ marginLeft: 12 }}>
              — Hạn tự chấm:{" "}
              <strong>{dayjs(period.selfEvalDeadline).format("DD/MM/YYYY HH:mm")}</strong>
            </span>
          )}
          {isSupplementable && supplementDeadline && !supplementExpired && (
            <span style={{ marginLeft: 12 }}>
              — Hạn bổ sung: <strong>{supplementDeadline.format("DD/MM/YYYY HH:mm")}</strong> (còn{" "}
              <Countdown
                value={supplementDeadline.valueOf()}
                format="HH:mm:ss"
                valueStyle={{ fontSize: 14, fontWeight: 700, color: "#cf1322", display: "inline" }}
              />
              )
            </span>
          )}
        </div>
      </div>

      {/* === FINALIZED RESULT === */}
      {isFinalized && (
        <Alert
          type="success"
          showIcon
          icon={<TrophyOutlined />}
          style={{ marginBottom: 24, borderRadius: 12 }}
          message={
            <span>
              <strong>Kết quả chính thức:</strong> Tổng điểm Admin:{" "}
              <strong>
                {totalAdminScore}/{totalMaxScore}
              </strong>{" "}
              — Tỷ lệ: <strong>{((totalAdminScore / totalMaxScore) * 100).toFixed(1)}%</strong>
              {evaluation.classification && (
                <Tag color="green" style={{ marginLeft: 8 }}>
                  {CLASSIFICATION_LABELS[evaluation.classification] || evaluation.classification}
                </Tag>
              )}
            </span>
          }
        />
      )}

      {/* === CRITERIA LIST === */}
      <Title level={5} style={{ marginBottom: 16 }}>
        Danh sách tiêu chí ({criteria.length} tiêu chí)
      </Title>

      {criteria.map((criterion) => {
        const cId = criterion.criterionId;
        const edited = editedScores[cId] || {};
        const canEdit =
          isEditable || (isSupplementable && criterion.needsSupplement && !supplementExpired);

        return (
          <div key={cId} className={styles.criteriaRow}>
            {/* Header */}
            <div className={styles.criteriaHeader}>
              <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <span className={styles.criteriaCode}>{criterion.code}</span>
                <span className={styles.criteriaName}>{criterion.name}</span>
                {criterion.needsSupplement && (
                  <span className={styles.supplementBadge} style={{ marginLeft: 8 }}>
                    Cần bổ sung
                  </span>
                )}
              </div>
              <span className={styles.criteriaMaxScore}>
                Điểm tối đa: <strong>{criterion.maxScore}</strong>
              </span>
            </div>

            {/* Score + Note */}
            <div className={styles.criteriaBody}>
              <div className={styles.scoreInput}>
                <span className={styles.scoreInputLabel}>Điểm tự chấm</span>
                <InputNumber
                  min={0}
                  max={criterion.maxScore}
                  value={edited.selfScore}
                  onChange={(val) => handleScoreChange(cId, "selfScore", val)}
                  disabled={!canEdit}
                  style={{ width: "100%" }}
                  placeholder={`0 - ${criterion.maxScore}`}
                />
              </div>
              <div className={styles.scoreInput}>
                <span className={styles.scoreInputLabel}>Diễn giải</span>
                <TextArea
                  rows={2}
                  value={edited.selfNote}
                  onChange={(e) => handleScoreChange(cId, "selfNote", e.target.value)}
                  disabled={!canEdit}
                  placeholder="Nhập diễn giải cho tiêu chí này..."
                />
              </div>
            </div>

            {/* Auto-save per criterion */}
            {canEdit && (
              <div style={{ marginTop: 8, textAlign: "right" }}>
                <Button size="small" type="link" onClick={() => handleSaveSingleScore(cId)}>
                  <SaveOutlined /> Lưu tiêu chí này
                </Button>
              </div>
            )}

            {/* Evidence Section */}
            <div className={styles.evidenceSection}>
              <div className={styles.evidenceTitle}>
                Minh chứng{" "}
                {criterion.evidenceRequired && (
                  <Tag color="red" style={{ fontSize: 11 }}>
                    Bắt buộc
                  </Tag>
                )}
              </div>

              {/* Existing evidences */}
              <div className={styles.evidenceList}>
                {(criterion.evidences || []).map((ev) => (
                  <Tooltip key={ev.id} title={ev.description || ev.fileName || ev.externalUrl}>
                    <div
                      className={styles.evidenceItem}
                      onClick={() => {
                        if (ev.kind === "LINK") {
                          window.open(ev.externalUrl, "_blank");
                        } else {
                          handlePreview(ev.id, ev.fileName);
                        }
                      }}>
                      {ev.kind === "LINK" ? <LinkOutlined /> : getFileIcon(ev.mimeType)}
                      <span>{ev.kind === "LINK" ? ev.description || "Link" : ev.fileName}</span>
                      {ev.round === "SUPPLEMENT" && <Badge status="warning" />}
                    </div>
                  </Tooltip>
                ))}

                {/* Add buttons */}
                {canEdit && (
                  <>
                    <Upload
                      showUploadList={false}
                      beforeUpload={(file) => handleFileUpload(file, cId)}
                      accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                      multiple>
                      <Button
                        size="small"
                        icon={<UploadOutlined />}
                        className={styles.addEvidenceBtn}>
                        Upload file
                      </Button>
                    </Upload>
                    <Button
                      size="small"
                      icon={<LinkOutlined />}
                      className={styles.addEvidenceBtn}
                      onClick={() => {
                        setLinkModalCriterion(cId);
                        setLinkUrl("");
                        setLinkDesc("");
                      }}>
                      Thêm link
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Admin Score (read-only, visible after review) */}
            {criterion.adminScore !== null && criterion.adminScore !== undefined && (
              <div className={styles.adminScoreSection}>
                <div className={styles.adminScoreLabel}>Điểm Admin</div>
                <div className={styles.adminScoreValue}>
                  {criterion.adminScore} / {criterion.maxScore}
                  {criterion.adminScore !== criterion.selfScore && (
                    <Tag color="orange" style={{ marginLeft: 8, fontSize: 12 }}>
                      Chênh lệch {criterion.adminScore - (criterion.selfScore || 0)} điểm
                    </Tag>
                  )}
                </div>
                {criterion.adminComment && (
                  <div className={styles.adminComment}>💬 {criterion.adminComment}</div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* === SAVE BAR === */}
      {(isEditable || (isSupplementable && !supplementExpired)) && (
        <div className={styles.saveBar}>
          {isSupplementable && (
            <Button
              type="primary"
              size="large"
              icon={<SendOutlined />}
              onClick={handleSubmitSupplement}
              style={{ borderRadius: 8 }}
              danger>
              Nộp bổ sung
            </Button>
          )}
          <Button
            type="primary"
            size="large"
            icon={<SaveOutlined />}
            onClick={handleSaveAll}
            loading={saving}
            style={{ borderRadius: 8, fontWeight: 600 }}>
            Lưu tất cả điểm
          </Button>
        </div>
      )}

      {/* === FEEDBACK SECTION === */}
      {feedbackList.length > 0 && (
        <div className={styles.feedbackSection}>
          <Divider orientation="left">
            <Text strong>Trao đổi với Admin</Text>
          </Divider>
          {feedbackList.map((fb) => (
            <div
              key={fb.id}
              className={`${styles.feedbackItem} ${fb.type === "UNIT_REPLY" ? styles.feedbackUnit : styles.feedbackAdmin}`}>
              <div className={styles.feedbackAuthor}>
                {fb.type === "UNIT_REPLY" ? "Bạn" : "Admin"}
              </div>
              <div className={styles.feedbackContent}>{fb.content}</div>
              <div className={styles.feedbackTime}>
                {dayjs(fb.createdAt).format("DD/MM/YYYY HH:mm")}
              </div>
            </div>
          ))}

          {/* Reply box */}
          {(isSupplementable || status === "PENDING_REVIEW") && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <TextArea
                rows={2}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Nhập phản hồi cho Admin..."
                style={{ borderRadius: 8 }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSendFeedback}
                loading={sendingFeedback}
                disabled={!feedbackText.trim()}
                style={{ borderRadius: 8, height: "auto" }}>
                Gửi
              </Button>
            </div>
          )}
        </div>
      )}

      {/* === LINK MODAL === */}
      <Modal
        title="Thêm link minh chứng"
        open={!!linkModalCriterion}
        onOk={handleAddLink}
        onCancel={() => setLinkModalCriterion(null)}
        okText="Thêm link"
        cancelText="Hủy">
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <Text strong>URL *</Text>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com/bai-viet"
              style={{ marginTop: 4, borderRadius: 8 }}
            />
          </div>
          <div>
            <Text strong>Mô tả</Text>
            <Input
              value={linkDesc}
              onChange={(e) => setLinkDesc(e.target.value)}
              placeholder="VD: Bài viết hoạt động tình nguyện"
              style={{ marginTop: 4, borderRadius: 8 }}
            />
          </div>
        </div>
      </Modal>

      {/* === PREVIEW MODAL === */}
      <Modal
        title={previewModal.title}
        open={previewModal.open}
        onCancel={() => setPreviewModal({ open: false, url: "", title: "" })}
        footer={null}
        width={800}>
        {previewModal.url &&
          (previewModal.url.match(/\.(jpg|jpeg|png|gif)$/i) ||
          previewModal.title?.match(/\.(jpg|jpeg|png|gif)$/i) ? (
            <img
              src={previewModal.url}
              alt={previewModal.title}
              style={{ width: "100%", borderRadius: 8 }}
            />
          ) : (
            <iframe
              src={previewModal.url}
              style={{ width: "100%", height: 500, border: "none", borderRadius: 8 }}
              title={previewModal.title}
            />
          ))}
      </Modal>
    </div>
  );
}
