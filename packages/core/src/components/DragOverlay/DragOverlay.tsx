import React, {useContext, useEffect, useRef} from 'react';
import {CSS} from '@dnd-kit/utilities';

import {getRelativeTransformOrigin} from '../../utilities';
import {applyModifiers, Modifiers} from '../../modifiers';
import {ActiveDraggableContext} from '../DndContext';
import {useDndContext} from '../../hooks';
import {useDerivedTransform, useDropAnimation, DropAnimation} from './hooks';

type TransitionGetter = (
  activatorEvent: Event | null
) => React.CSSProperties['transition'] | undefined;

export interface Props {
  adjustScale?: boolean;
  children?: React.ReactNode;
  className?: string;
  dropAnimation?: DropAnimation | null | undefined;
  style?: React.CSSProperties;
  transition?: string | TransitionGetter;
  modifiers?: Modifiers;
  wrapperElement?: keyof JSX.IntrinsicElements;
  zIndex?: number;
}

const defaultTransition: TransitionGetter = (activatorEvent) => {
  const isKeyboardActivator = activatorEvent instanceof KeyboardEvent;

  return isKeyboardActivator ? 'transform 250ms ease' : undefined;
};

export const defaultDropAnimation: DropAnimation = {
  duration: 250,
  easing: 'ease',
  dragSourceOpacity: 0,
};

export const DragOverlay = React.memo(
  ({
    adjustScale = false,
    children,
    dropAnimation = defaultDropAnimation,
    transition = defaultTransition,
    modifiers,
    wrapperElement = 'div',
    className,
    zIndex = 999,
  }: Props) => {
    const {
      active,
      activeNodeRect,
      activeNodeClientRect,
      containerNodeRect,
      draggableNodes,
      activatorEvent,
      overlayNode,
      scrollableAncestors,
      scrollableAncestorRects,
      windowRect,
    } = useDndContext();
    const transform = useContext(ActiveDraggableContext);
    const modifiedTransform = applyModifiers(modifiers, {
      transform,
      activeNodeRect: activeNodeClientRect,
      overlayNodeRect: overlayNode.rect,
      draggingNodeRect: overlayNode.rect,
      containerNodeRect,
      scrollableAncestors,
      scrollableAncestorRects,
      windowRect,
    });
    const derivedTransform = useDerivedTransform(
      modifiedTransform,
      activeNodeRect,
      overlayNode.nodeRef.current
    );
    const isDragging = active !== null;
    const intermediateTransform = derivedTransform ?? modifiedTransform;
    const finalTransform = adjustScale
      ? intermediateTransform
      : {
          ...intermediateTransform,
          scaleX: 1,
          scaleY: 1,
        };
    const style: React.CSSProperties | undefined = activeNodeRect
      ? {
          position: 'fixed',
          width: activeNodeRect.width,
          height: activeNodeRect.height,
          top: activeNodeRect.top,
          left: activeNodeRect.left,
          zIndex,
          transform: CSS.Transform.toString(finalTransform),
          touchAction: 'none',
          transformOrigin:
            adjustScale && activatorEvent
              ? getRelativeTransformOrigin(
                  activatorEvent as MouseEvent | KeyboardEvent | TouchEvent,
                  activeNodeRect
                )
              : undefined,
          transition: derivedTransform
            ? undefined
            : typeof transition === 'function'
            ? transition(activatorEvent)
            : transition,
        }
      : undefined;
    const attributes = isDragging
      ? {
          style,
          children,
          className,
          transform: finalTransform,
        }
      : undefined;
    const attributesSnapshot = useRef(attributes);
    const derivedAttributes = attributes ?? attributesSnapshot.current;
    const {children: finalChildren, transform: _, ...otherAttributes} =
      derivedAttributes ?? {};
    const prevActive = useRef(active);
    const dropAnimationComplete = useDropAnimation({
      animate: Boolean(dropAnimation && prevActive.current && !active),
      adjustScale,
      activeId: prevActive.current,
      draggableNodes,
      duration: dropAnimation?.duration,
      easing: dropAnimation?.easing,
      dragSourceOpacity: dropAnimation?.dragSourceOpacity,
      node: overlayNode.nodeRef.current,
      transform: attributesSnapshot.current?.transform,
    });
    const shouldRender = Boolean(
      finalChildren && (children || (dropAnimation && !dropAnimationComplete))
    );

    useEffect(() => {
      if (prevActive.current !== active) {
        prevActive.current = active;
      }

      if (active && attributesSnapshot.current !== attributes) {
        attributesSnapshot.current = attributes;
      }
    }, [active, attributes]);

    useEffect(() => {
      if (dropAnimationComplete) {
        attributesSnapshot.current = undefined;
      }
    }, [dropAnimationComplete]);

    if (!shouldRender) {
      return null;
    }

    return React.createElement(
      wrapperElement,
      {
        ...otherAttributes,
        ref: overlayNode.setRef,
      },
      finalChildren
    );
  }
);
