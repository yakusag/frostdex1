import React from "react";
import { Helmet } from "react-helmet-async";

type MetaTag =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string };

type LinkTag = {
  rel: string;
  href: string;
  hrefLang?: string;
};

export type SEOTag = MetaTag | LinkTag;

export function renderSEOTags(tags: SEOTag[], pageTitle?: string) {
  const elements: React.ReactElement[] = [];

  if (pageTitle) {
    elements.push(<title key="title">{pageTitle}</title>);
  }

  tags.forEach((tag, index) => {
    if ('title' in tag) {
      if (!pageTitle) {
        elements.push(<title key="title">{tag.title}</title>);
      }
    } else if ('rel' in tag) {
      elements.push(
        <link
          key={`link-${index}`}
          rel={tag.rel}
          href={tag.href}
          {...(tag.hrefLang && { hrefLang: tag.hrefLang })}
        />
      );
    } else if ('name' in tag) {
      elements.push(
        <meta key={`meta-name-${index}`} name={tag.name} content={tag.content} />
      );
    } else if ('property' in tag) {
      elements.push(
        <meta key={`meta-property-${index}`} property={tag.property} content={tag.content} />
      );
    }
  });

  return (
    <Helmet>
      {elements as unknown as React.ReactNode}
    </Helmet>
  );
}
