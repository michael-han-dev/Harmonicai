import { useEffect, useState } from "react";
import { getCollectionsById, ICompany, ICollection, startBulkAdd } from "../utils/jam-api";
import { BackgroundTask } from "./BackgroundTasksManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight } from "lucide-react";

type SelectionMode = 'none' | 'all';

interface CompanyTableProps {
  selectedCollectionId: string;
  collectionResponse?: ICollection[];
  onStartBulkTask: (task: BackgroundTask) => void;
  getCollectionName: (collectionId: string) => string;
}

const CompanyTable = (props: CompanyTableProps) => {
  const [response, setResponse] = useState<ICompany[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [pageSize, setPageSize] = useState(25);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('none');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    getCollectionsById(props.selectedCollectionId, offset, pageSize).then(
      (newResponse) => {
        setResponse(newResponse.companies);
        setTotal(newResponse.total);
        setIsLoading(false);
      }
    );
  }, [props.selectedCollectionId, offset, pageSize]);

  useEffect(() => {
    setOffset(0);
    setSelectionMode('none');
    setSelectedIds(new Set());
    setExcludedIds(new Set());
  }, [props.selectedCollectionId]);

  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.ceil(total / pageSize);

  // Helper functions for selection state
  const isCompanySelected = (companyId: number): boolean => {
    if (selectionMode === 'all') {
      return !excludedIds.has(companyId);
    }
    return selectedIds.has(companyId);
  };

  const getSelectedCount = (): number => {
    if (selectionMode === 'all') {
      return total - excludedIds.size;
    }
    return selectedIds.size;
  };

  const getSelectedCompanyIds = (): number[] => {
    if (selectionMode === 'all') {
      // Return mode='all' for API calls
      return [];
    }
    return Array.from(selectedIds);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      if (total > response.length) {
        // More companies exist beyond current page - select all in collection
        setSelectionMode('all');
        setExcludedIds(new Set());
        setSelectedIds(new Set());
      } else {
        //selects on current page
        setSelectionMode('none');
        setSelectedIds(new Set(response.map(c => c.id)));
        setExcludedIds(new Set());
      }
    } else {
      // Deselect all
      setSelectionMode('none');
      setSelectedIds(new Set());
      setExcludedIds(new Set());
    }
  };

  const handleSelectCompany = (companyId: number, checked: boolean) => {
    if (selectionMode === 'all') {
      const newExcluded = new Set(excludedIds);
      if (checked) {
        newExcluded.delete(companyId);
      } else {
        newExcluded.add(companyId);
      }
      setExcludedIds(newExcluded);
    } else {
      const newSelected = new Set(selectedIds);
      if (checked) {
        newSelected.add(companyId);
      } else {
        newSelected.delete(companyId);
      }
      setSelectedIds(newSelected);
    }
  };

  // Find the "Liked Companies List" collection
  const likedCollection = props.collectionResponse?.find(c => 
    c.collection_name === "Liked Companies List"
  );

  const handleBulkAddToLiked = async () => {
    if (!likedCollection) {
      alert('Could not find "Liked Companies List" collection');
      return;
    }

    const mode = selectionMode === 'all' ? 'all' : 'selected';
    const companyIds = getSelectedCompanyIds();

    if (mode === 'selected' && companyIds.length === 0) {
      alert('No companies selected');
      return;
    }

    try {
      const result = await startBulkAdd(props.selectedCollectionId, likedCollection.id, {
        mode,
        companyIds: mode === 'selected' ? companyIds : undefined,
      });

      const task: BackgroundTask = {
        taskId: result.task_id,
        type: 'bulk_add',
        sourceCollectionName: props.getCollectionName(props.selectedCollectionId),
        targetCollectionName: likedCollection.collection_name,
        targetCollectionId: likedCollection.id,
        description: `Adding ${mode === 'all' ? 'all' : getSelectedCount()} companies to ${likedCollection.collection_name}`,
        startTime: new Date(),
      };

      props.onStartBulkTask(task);

      // Reset selection after starting task
      setSelectionMode('none');
      setSelectedIds(new Set());
      setExcludedIds(new Set());

    } catch (error) {
      console.error('Error starting bulk add:', error);
      alert('Failed to start bulk operation');
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Companies ({total.toLocaleString()} total)</span>
          <div className="text-sm font-normal text-muted-foreground">
            {getSelectedCount()} selected
            {selectionMode === 'all' && (
              <span className="ml-1 text-blue-400">(all)</span>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-muted-foreground">Loading companies...</div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto">
              <Table className="w-full table-fixed">
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-12 text-left">
                      <Checkbox
                        checked={
                          selectionMode === 'all' || 
                          (response.length > 0 && response.every(c => isCompanySelected(c.id)))
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-64 text-left">Company</TableHead>
                    <TableHead className="w-48 text-left">Industry</TableHead>
                    <TableHead className="w-24 text-center">Team Size</TableHead>
                    <TableHead className="w-32 text-center">Funding</TableHead>
                    <TableHead className="w-24 text-center">Founded</TableHead>
                    <TableHead className="w-20 text-center">Liked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {response.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="w-12 text-left">
                        <Checkbox
                          checked={isCompanySelected(company.id)}
                          onCheckedChange={(checked) => 
                            handleSelectCompany(company.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell className="w-64 font-medium text-left">
                        {company.company_name}
                        <div className="text-xs text-muted-foreground font-mono">ID: {company.id}</div>
                      </TableCell>
                      <TableCell className="w-48 text-left">{company.industry}</TableCell>
                      <TableCell className="w-24 text-center">{company.team_size}</TableCell>
                      <TableCell className="w-32 text-center">{company.funding_round}</TableCell>
                      <TableCell className="w-24 text-center">{company.founded_year}</TableCell>
                      <TableCell className="w-20 text-center">
                        <Badge variant={company.liked ? "default" : "secondary"}>
                          {company.liked ? "❤️" : "X"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            <div className="flex items-center justify-between p-4 border-t bg-background">
              <div className="text-sm text-muted-foreground">
                Showing {offset + 1} to {Math.min(offset + pageSize, total)} of {total.toLocaleString()} companies
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - pageSize))}
                  disabled={offset === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="text-sm">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + pageSize)}
                  disabled={offset + pageSize >= total}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Bulk Actions */}
            {getSelectedCount() > 0 && (
              <div className="p-4 bg-accent border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    {getSelectedCount()} companies selected
                    {selectionMode === 'all' && (
                      <span className="text-blue-400"> (entire collection)</span>
                    )}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleBulkAddToLiked}>
                      Add to Liked
                    </Button>
                    <Button size="sm" variant="outline">
                      Remove from List
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanyTable;