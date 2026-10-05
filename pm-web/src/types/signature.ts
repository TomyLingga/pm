/** `GET /api/v1/public/signatures/{token}` */
export interface PublicSignature {
  document_type_label: string;
  document_number: string;
  role_label: string;
  signer_name: string;
  signer_nrk: string | null;
  signer_position: string | null;
  signed_at: string;
  document_status_label: string;
  is_valid: boolean;
}
