import { useEffect, useState } from "react";
import { getCollectionsById, ICompany } from "../utils/jam-api";
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

const CompanyTable = (props: { selectedCollectionId: string }) => {
  const [response, setResponse] = useState<ICompany[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [pageSize, setPageSize] = useState(25);
  const [selectedCompanies, setSelectedCompanies] = useState<Set<number>>(new Set());
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
    setSelectedCompanies(new Set());
  }, [props.selectedCollectionId]);

  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.ceil(total / pageSize);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCompanies(new Set(response.map(company => company.id)));
    } else {
      setSelectedCompanies(new Set());
    }
  };

  const handleSelectCompany = (companyId: number, checked: boolean) => {
    const newSelected = new Set(selectedCompanies);
    if (checked) {
      newSelected.add(companyId);
    } else {
      newSelected.delete(companyId);
    }
    setSelectedCompanies(newSelected);
  };

  const getFundingRoundColor = (fundingRound: string) => {
    const colors = {
      "pre-seed": "bg-red-500/20 text-red-300 border-red-500/30",
      "seed": "bg-orange-500/20 text-orange-300 border-orange-500/30", 
      "Series A": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
      "Series B": "bg-green-500/20 text-green-300 border-green-500/30",
      "Series C": "bg-blue-500/20 text-blue-300 border-blue-500/30",
    };
    return colors[fundingRound as keyof typeof colors] || "bg-gray-500/20 text-gray-300 border-gray-500/30";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Companies ({total.toLocaleString()} total)</span>
          <div className="text-sm font-normal text-muted-foreground">
            {selectedCompanies.size} selected
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-muted-foreground">Loading companies...</div>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedCompanies.size === response.length && response.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Team Size</TableHead>
                    <TableHead>Funding</TableHead>
                    <TableHead>Founded</TableHead>
                    <TableHead>Liked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {response.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedCompanies.has(company.id)}
                          onCheckedChange={(checked) => 
                            handleSelectCompany(company.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {company.company_name}
                        <div className="text-xs text-muted-foreground">ID: {company.id}</div>
                      </TableCell>
                      <TableCell>{company.industry}</TableCell>
                      <TableCell>{company.team_size}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={getFundingRoundColor(company.funding_round)}
                        >
                          {company.funding_round}
                        </Badge>
                      </TableCell>
                      <TableCell>{company.founded_year}</TableCell>
                      <TableCell>
                        <Badge variant={company.liked ? "default" : "secondary"}>
                          {company.liked ? "❤️ Liked" : "🤍"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
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
            {selectedCompanies.size > 0 && (
              <div className="mt-4 p-4 bg-accent rounded-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    {selectedCompanies.size} companies selected
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
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