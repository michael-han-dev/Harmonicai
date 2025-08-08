import axios from 'axios';

export interface ICompany {
    id: number;
    company_name: string;
    team_size: number;
    funding_round: string;
    industry: string;
    founded_year: number;
    liked: boolean;
}

export interface ICollection {
    id: string;
    collection_name: string;
    companies: ICompany[];
    total: number;
}

export interface ICompanyBatchResponse {
    companies: ICompany[];
}

// Operations API interfaces
export interface IBatchRequest {
    mode: 'all' | 'selected';
    companyIds?: number[];
}

export interface IBatchResponse {
    task_id: string;
}

export interface IOperationStatus {
    task_id: string;
    state: string;
    status: string;
    current: number;
    total: number;
    percent?: number;
    eta_seconds?: number;
    message?: string;
}

export interface IUndoRequest {
    target_collection_id: string;
}

export interface IUndoResponse {
    undo_task_id: string;
}

const BASE_URL = 'http://localhost:8000';

export async function getCompanies(offset?: number, limit?: number): Promise<ICompanyBatchResponse> {
    try {
        const response = await axios.get(`${BASE_URL}/companies`, {
            params: {
                offset,
                limit,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching companies:', error);
        throw error;
    }
}

export async function getCollectionsById(id: string, offset?: number, limit?: number): Promise<ICollection> {
    try {
        const response = await axios.get(`${BASE_URL}/collections/${id}`, {
            params: {
                offset,
                limit,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching companies:', error);
        throw error;
    }
}

export async function getCollectionsMetadata(): Promise<ICollection[]> {
    try {
        const response = await axios.get(`${BASE_URL}/collections`);
        return response.data;
    } catch (error) {
        console.error('Error fetching companies:', error);
        throw error;
    }
}

export async function createCollection(collection_name: string): Promise<ICollection> {
    try {
        const response = await axios.post(`${BASE_URL}/collections`, { collection_name });
        return response.data;
    } catch (error) {
        console.error('Error creating collection:', error);
        throw error;
    }
}

export async function deleteCollection(id: string): Promise<void> {
    try {
        await axios.delete(`${BASE_URL}/collections/${id}`);
    } catch (error) {
        console.error('Error deleting collection:', error);
        throw error;
    }
}

// Operations API functions
export async function startBulkAdd(
    sourceId: string,
    targetId: string,
    payload: IBatchRequest
): Promise<IBatchResponse> {
    try {
        const response = await axios.post(
            `${BASE_URL}/collections/${sourceId}/to/${targetId}/companies/batch`,
            payload
        );
        return response.data;
    } catch (error) {
        console.error('Error starting bulk add:', error);
        throw error;
    }
}

export async function getOperationStatus(taskId: string): Promise<IOperationStatus> {
    try {
        const response = await axios.get(`${BASE_URL}/operations/${taskId}/status`);
        return response.data;
    } catch (error) {
        console.error('Error fetching operation status:', error);
        throw error;
    }
}

export async function cancelOperation(taskId: string): Promise<{ status: string }> {
    try {
        const response = await axios.post(`${BASE_URL}/operations/${taskId}/cancel`);
        return response.data;
    } catch (error) {
        console.error('Error cancelling operation:', error);
        throw error;
    }
}

export async function undoOperation(taskId: string, payload: IUndoRequest): Promise<IUndoResponse> {
    try {
        const response = await axios.post(`${BASE_URL}/operations/${taskId}/undo`, payload);
        return response.data;
    } catch (error) {
        console.error('Error undoing operation:', error);
        throw error;
    }
}

// Delete specific companies from a collection
export async function deleteCompaniesFromCollection(collectionId: string, companyIds: number[]): Promise<{ deleted: number }>{
    try {
        const response = await axios.post(`${BASE_URL}/collections/${collectionId}/companies/delete`, {
            companyIds,
        });
        return response.data;
    } catch (error) {
        console.error('Error deleting companies from collection:', error);
        throw error;
    }
}