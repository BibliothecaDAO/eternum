import React, { forwardRef, useMemo, useLayoutEffect } from 'react';
import { Vector2, Object3D } from 'three';
import { useThree } from '@react-three/fiber';
import { Effect, BlendFunction } from 'postprocessing';

const isRef = (ref: any) => !!ref.current;

export const resolveRef = (ref: any) => (isRef(ref) ? ref.current : ref);

export const currencyFormat = (num: any) => {
    return num.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

export const wrapEffect = (effectImpl: any, defaultBlendMode = BlendFunction.ALPHA) =>
    forwardRef(function Wrap({ blendFunction, opacity, ...props }: any, ref) {
        const invalidate = useThree((state) => state.invalidate);
        const effect = useMemo(() => new effectImpl(props), [props]);

        useLayoutEffect(() => {
            effect.blendMode.blendFunction = !blendFunction && blendFunction !== 0 ? defaultBlendMode : blendFunction;
            if (opacity !== undefined) effect.blendMode.opacity.value = opacity;
            invalidate();
        }, [blendFunction, effect.blendMode, opacity]);
        return <primitive ref={ref} object={effect} dispose={null} />;
    });

export const useVector2 = (props: any, key: any) => {
    const vec = props[key];
    return useMemo(() => {
        if (vec instanceof Vector2) {
            return new Vector2().set(vec.x, vec.y);
        } else if (Array.isArray(vec)) {
            const [x, y] = vec;
            return new Vector2().set(x, y);
        }
    }, [vec]);
};