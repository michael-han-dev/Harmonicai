import { useCallback, useEffect, useRef, useState } from 'react';



const useApi = <T>(apiFunction: () => Promise<T>) => {
    const [data, setData] = useState<T>();
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Keep latest apiFunction in a ref to avoid re-creating callbacks on each render
    const fnRef = useRef(apiFunction);
    useEffect(() => {
        fnRef.current = apiFunction;
    }, [apiFunction]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fnRef.current();
            setData(response);
        } catch (err: any) {
            setError(err?.message ?? 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, error, refetch: fetchData };
};

export default useApi;