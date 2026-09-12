export interface GuardrailResult {
  safe: boolean;
  reason?: string;
  flaggedContent?: string;
}
