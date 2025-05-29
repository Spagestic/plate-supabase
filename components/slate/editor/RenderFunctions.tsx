/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback } from "react";
import { CodeElement } from "../elements/CodeElement";
import { DefaultElement } from "../elements/DefaultElement";
import { Leaf } from "../elements/Leaf";

export const useRenderFunctions = () => {
  const renderElement = useCallback((props: any) => {
    switch (props.element.type) {
      case "code":
        return <CodeElement {...props} />;
      default:
        return <DefaultElement {...props} />;
    }
  }, []);

  const renderLeaf = useCallback((props: any) => {
    return <Leaf {...props} />;
  }, []);

  return { renderElement, renderLeaf };
};
