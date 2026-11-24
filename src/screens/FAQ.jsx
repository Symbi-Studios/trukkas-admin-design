"use client";
import { usePageSearchState } from '../components/PageSearch.jsx';


import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "../router.js";
import {
  PageHeader,
  Button,
  Card,
  SectionCard,
  SearchField,
  Tabs,
  Icon,
} from "../ds.js";
import { FAQ_CATEGORIES, useGetAdminFaqDirectoryQuery } from "../store/features/faq/faqApi.js";
import { DriverTableLoading } from "./DriversLoading.jsx";
import { getApiErrorMessage } from "../store/api/getApiErrorMessage.js";

function FaqItem({ item, open, onToggle }) {
  return (
    <div style={{ borderBottom: "1px solid var(--tk-line)" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "13px 2px",
          border: 0,
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <Icon
          name={open ? "chevron-down" : "chevron-right"}
          size={15}
          color="var(--tk-ink-300)"
        />
        <span
          style={{
            flex: 1,
            font: "600 13px/19px var(--tk-font-sans)",
            color: "var(--tk-ink-900)",
          }}
        >
          {item.q}
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 2px 16px 25px" }}>
          <span
            style={{
              font: "400 13px/20px var(--tk-font-sans)",
              color: "var(--tk-ink-500)",
              whiteSpace: "pre-line",
            }}
          >
            {item.a}
          </span>
        </div>
      )}
    </div>
  );
}

export function FAQ() {
  const admin = useSelector((state) => state.auth.admin);
  const authenticated = useSelector((state) => Boolean(state.auth.accessToken));
  const navigate = useNavigate();
  const query = useGetAdminFaqDirectoryQuery({ owner: admin?.id }, { skip: !authenticated, refetchOnMountOrArgChange: true });
  const groups = useMemo(() => authenticated && !query.error ? query.currentData || [] : [], [authenticated, query.error, query.currentData]);
  const loading = !authenticated || query.isLoading || query.isFetching;
  const [category, setCategory] = useState("All Categories");
  const [q, setQ] = usePageSearchState("");
  const [openKey, setOpenKey] = useState(null);
  useEffect(() => { setOpenKey(null); }, [admin?.id]);
  const available = authenticated && !query.error && Boolean(query.currentData)
    && (category === "All Categories" || groups.every((group) => group.categoryAvailable))
    && (!q.trim() || groups.every((group) => group.questions.every((item) => item.questionAvailable && item.answerAvailable)));

  const visibleGroups = useMemo(() => {
    const term = q.trim().toLowerCase();
    return groups
      .filter((g) => category === "All Categories" || g.key === category)
      .map((g) => ({
        ...g,
        questions: term
          ? g.questions.filter(
              (it) =>
                it.q.toLowerCase().includes(term) ||
                it.a.toLowerCase().includes(term),
            )
          : g.questions,
      }))
      .filter((g) => g.questions.length > 0);
  }, [groups, category, q]);

  return (
    <>
      <PageHeader
        crumbs={["Support System", "FAQ"]}
        actions={<Button icon="plus" onClick={() => navigate("/faq/new")}>Add FAQ</Button>}
        title="FAQ"
        description="Find answers to frequently asked questions about the Trukkas platform."
      />

      <Card pad="none">
        <Tabs
          value={category}
          onChange={setCategory}
          style={{ padding: "0 var(--tk-card-pad)" }}
          items={[...FAQ_CATEGORIES, ...groups.map(group => group.key).filter(key => key !== "—" && !FAQ_CATEGORIES.includes(key))]}
        />
      </Card>

      <div style={{ display: "grid", gap: "var(--tk-grid-gap)" }}>
          <SearchField
            placeholder="Search frequently asked questions…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {loading && <Card pad="none"><DriverTableLoading columns={1} label="Loading FAQs" /></Card>}
          {!loading && (!available || visibleGroups.length === 0) && (
            <Card>
              <span className="tk-body">{query.error ? getApiErrorMessage(query.error) : !available ? "—" : <>No questions match "{q}".</>}</span>
            </Card>
          )}

          {!loading && available && visibleGroups.map((g) => (
            <SectionCard
              key={g.key}
              title={g.key}
              icon={g.icon}
              count={g.questions.length}
            >
              <div>
                {g.questions.map((item) => {
                  const key = item.key;
                  return (
                    <FaqItem
                      key={key}
                      item={item}
                      open={openKey === key}
                      onToggle={() => setOpenKey(openKey === key ? null : key)}
                    />
                  );
                })}
              </div>
            </SectionCard>
          ))}
      </div>
    </>
  );
}
