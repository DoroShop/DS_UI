export interface SellerApplication {
  shopName?: string
  shopAddress?: string
  address?: {
    region?: string
    province?: string
    municipality?: string
    barangay?: string
    zipCode?: string
    street?: string
    additionalInfo?: string
  }
  governmentIdUrl?: string
  governmentIdPublicId?: string
  birTinUrl?: string
  birTinPublicId?: string
  dtiOrSecUrl?: string
  dtiOrSecPublicId?: string
  fdaCertificateUrl?: string
  fdaCertificatePublicId?: string
  businessPermitUrl?: string
  businessPermitPublicId?: string
  status: 'not_applied' | 'pending' | 'approved' | 'rejected'
  rejectionReason?: string
  submittedAt?: string
  reviewedAt?: string
  reviewedBy?: string
}

export interface SellerApplicationForm {
  shopName: string
  region: string
  province: string
  municipality: string
  barangay: string
  zipCode: string
  street?: string
  additionalInfo?: string
  shopAddress?: string
  governmentId: File | null
  birTin: File | null
  dtiOrSec: File | null
  fdaCertificate?: File | null
  businessPermit: File | null
}

export interface SellerApplicationResponse {
  success: boolean
  message?: string
  application?: SellerApplication
  error?: string
  details?: string[]
}