import { useEffect, useState } from "react";
import "./App.css";
import CompanyTable from "./components/CompanyTable";
import { getCollectionsMetadata } from "./utils/jam-api";
import useApi from "./utils/useApi";
import { Card } from "@/components/ui/card";
import ThemeToggle from "@/components/ui/ThemeToggle";

function App() {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>();
  const { data: collectionResponse } = useApi(() => getCollectionsMetadata());

  useEffect(() => {
    setSelectedCollectionId(collectionResponse?.[0]?.id);
  }, [collectionResponse]);

  useEffect(() => {
    if (selectedCollectionId) {
      window.history.pushState({}, "", `?collection=${selectedCollectionId}`);
    }
  }, [selectedCollectionId]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-8 py-6">
        <div className="flex items-center justify-between border-b border-border pb-2 mb-6">
          <div className="font-bold text-xl">Harmonic Jam</div>
          <ThemeToggle />
        </div>
        <div className="flex gap-6">
          <div className="w-1/5">
            <Card className="p-4">
              <p className="font-bold border-b border-border mb-4 pb-2 text-left">
                Collections
              </p>
              <div className="flex flex-col gap-2 text-left">
                {collectionResponse?.map((collection) => {
                  return (
                    <div
                      key={collection.id}
                      className={`py-2 px-4 rounded-md cursor-pointer transition-colors ${
                        selectedCollectionId === collection.id
                          ? "bg-primary text-primary-foreground font-bold"
                          : "hover:bg-accent hover:text-accent-foreground"
                      }`}
                      onClick={() => {
                        setSelectedCollectionId(collection.id);
                      }}
                    >
                      {collection.collection_name}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
          <div className="w-4/5">
            {selectedCollectionId && (
              <CompanyTable selectedCollectionId={selectedCollectionId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;