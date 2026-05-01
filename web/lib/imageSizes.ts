export type ImageSizeOption = {
  value: string;
  label: string;
};

export const defaultImageSizeOptions: ImageSizeOption[] = [
  { value: "auto", label: "auto（自动适应）" },
  { value: "1024x1024", label: "1024x1024（小红书方图）" },
  { value: "1024x1536", label: "1024x1536（小红书竖图）" },
  { value: "1536x1024", label: "1536x1024（横版海报）" },
  { value: "2048x2048", label: "2048x2048（高清方图）" },
  { value: "2048x1152", label: "2048x1152（高清横图 / 16:9横图）" },
  { value: "2160x3840", label: "2160x3840（4K竖图 / 抖音竖屏）" },
  { value: "3840x2160", label: "3840x2160（4K横图 / 16:9横屏）" },
  { value: "1088x1920", label: "1088x1920（标准9:16竖图）" },
  { value: "1920x1088", label: "1920x1088（标准16:9横图）" },
  { value: "1440x1440", label: "1440x1440（高清方图）" },
  { value: "1280x1920", label: "1280x1920（竖版海报）" },
  { value: "1920x1280", label: "1920x1280（横版宣传图）" },
];

export function normalizeImageSizeOptions(options: unknown): ImageSizeOption[] {
  if (!Array.isArray(options)) return defaultImageSizeOptions;
  const seen = new Set<string>();
  const normalized = options.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const value = String((item as { value?: unknown }).value ?? "").trim();
    const label = String((item as { label?: unknown }).label ?? "").trim();
    if (!value || seen.has(value)) return [];
    if (value !== "auto" && !/^\d{2,5}x\d{2,5}$/.test(value)) return [];
    seen.add(value);
    return [{ value, label: label || value }];
  });
  return normalized.length ? normalized : defaultImageSizeOptions;
}
