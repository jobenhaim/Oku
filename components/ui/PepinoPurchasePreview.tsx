import React from 'react';
import { Icons } from './Icons';
import { PepinoArtwork } from './PepinoArtwork';

// Decorative only: no timers, movement, reward state, or claim interaction.
export const PepinoPurchasePreview = () => (
    <div className="pepino-purchase-preview" role="img" aria-label="Pepino in his aquarium with a gift on top">
        <div className="shop-aquarium pepino-purchase-tank" aria-hidden="true">
            <div className="shop-aquarium-light" />
            <div className="shop-aquarium-plant shop-aquarium-plant--left" />
            <div className="shop-aquarium-plant shop-aquarium-plant--right" />
            <div className="shop-aquarium-pebbles" />
            <div className="pepino-purchase-fish"><PepinoArtwork /></div>
            <div className="pepino-purchase-gift">
                <Icons.Gift className="w-4 h-4" strokeWidth={2} />
            </div>
        </div>
    </div>
);
