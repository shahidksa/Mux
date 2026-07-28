export interface Transfer {
  id: number;
  source_wallet_id: number;
  destination_wallet_id: number;
  amount: number;
  transfer_type?: string;
  date?: string;
  description?: string;
  created_at: string;
}

export interface TransferFormData {
  source_wallet_id: number;
  destination_wallet_id: number;
  amount: number;
}