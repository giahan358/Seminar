/**
 * Các loại đơn vị hợp lệ. Khớp với ràng buộc trong DB:
 * CONSTRAINT "units_unit_type_check" CHECK (unit_type IS NULL OR unit_type IN (...))
 * Nếu DB thêm loại mới thì sửa ở đúng một chỗ này.
 */
export const UNIT_TYPES = [
  "CONG_AN_QUAN_HUYEN",
  "PHONG_NGHIEP_VU",
  "DON_VI_TRUC_THUOC",
] as const;

export type UnitType = (typeof UNIT_TYPES)[number];

export const UNIT_TYPE_MESSAGE =
  "unitType chỉ được là CONG_AN_QUAN_HUYEN, PHONG_NGHIEP_VU hoặc DON_VI_TRUC_THUOC.";