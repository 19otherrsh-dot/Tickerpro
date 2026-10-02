import axios from "axios";

const META_GRAPH_VERSION = "v18.0";

/**
 * Meta Commerce API Client for managing Catalogs and Products
 * Requires `catalog_management` permissions on the Meta App.
 */
export class MetaCommerceClient {
  private accessToken: string;
  private businessId: string;

  constructor(accessToken: string, businessId: string) {
    this.accessToken = accessToken;
    this.businessId = businessId;
  }

  private get baseUrl() {
    return `https://graph.facebook.com/${META_GRAPH_VERSION}`;
  }

  /**
   * Create a new Product Catalog for the Business
   */
  async createCatalog(name: string): Promise<string> {
    try {
      const response = await axios.post(`${this.baseUrl}/${this.businessId}/product_catalogs`, {
        name,
        access_token: this.accessToken
      });
      return response.data.id;
    } catch (error: any) {
      console.error("Failed to create Meta Catalog:", error.response?.data || error.message);
      throw new Error("Meta API Error: " + (error.response?.data?.error?.message || "Unknown error"));
    }
  }

  /**
   * Fetch all catalogs for the business
   */
  async getCatalogs() {
    try {
      const response = await axios.get(`${this.baseUrl}/${this.businessId}/product_catalogs`, {
        params: { access_token: this.accessToken }
      });
      return response.data.data;
    } catch (error: any) {
      console.error("Failed to fetch catalogs:", error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Batch upload products to a specific catalog
   */
  async batchUpdateProducts(catalogId: string, requests: any[]) {
    try {
      const response = await axios.post(`${this.baseUrl}/${catalogId}/batch`, {
        requests,
        access_token: this.accessToken
      });
      return response.data;
    } catch (error: any) {
      console.error("Failed to batch update products:", error.response?.data || error.message);
      throw new Error("Meta API Error: " + (error.response?.data?.error?.message || "Unknown error"));
    }
  }
}
