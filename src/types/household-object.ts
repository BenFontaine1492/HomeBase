/** A household object (appliance, device, furniture, …) in the inventory. */
export interface HouseholdObject {
  id: number
  name: string
  /** null = "No category assigned". */
  categoryId: number | null
  manufacturer: string | null
  model: string | null
  serialNumber: string | null
  /** 'YYYY-MM-DD' */
  purchaseDate: string | null
  /** Purchase price in cents (integer). */
  purchasePriceCents: number | null
  /** 'YYYY-MM-DD' */
  installationDate: string | null
  location: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

/** User-editable fields of an object, used for both creating and updating. */
export interface HouseholdObjectInput {
  name: string
  categoryId: number | null
  manufacturer?: string | null
  model?: string | null
  serialNumber?: string | null
  purchaseDate?: string | null
  purchasePriceCents?: number | null
  installationDate?: string | null
  location?: string | null
  notes?: string | null
}
