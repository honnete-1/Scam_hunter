import { useSearchParams } from "react-router";
import CheckPanel from "../components/CheckPanel";

// Lets other pages link straight to a tab, e.g. /check?type=url
const TYPES_FROM_QUERY = { message: "MESSAGE", url: "URL", phone: "PHONE" };

export default function CheckPage() {
  const [params] = useSearchParams();
  const initialType = TYPES_FROM_QUERY[params.get("type")] || "MESSAGE";

  return (
    <div className="container container--narrow page-body">
      <header className="page-header">
        <h1 className="page-title">Check something suspicious</h1>
        <p className="lead">Nothing you check here is saved.</p>
      </header>
      <CheckPanel initialType={initialType} titleTag="h2" />
    </div>
  );
}
