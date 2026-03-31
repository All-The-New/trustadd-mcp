import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";

export default function NotFound() {
  return (
    <Layout>
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <Card className="w-full max-w-md p-8">
          <div className="flex flex-col items-center text-center">
            <Shield className="w-10 h-10 text-muted-foreground mb-4" />
            <h1 className="text-xl font-bold mb-1" data-testid="text-404-title">Page Not Found</h1>
            <p className="text-sm text-muted-foreground mb-4">
              The page you're looking for doesn't exist or has been moved.
            </p>
            <Link href="/">
              <Button variant="outline" className="gap-2" data-testid="button-go-home">
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
